import {standaloneMetaRange} from "@/lib/nre/meta-report-content/range";
import {metaReportSelectionSchema,metaReportOptions,assertMetaReportSource} from "@/lib/nre/meta-report-content/selection";
import {audienceOnlyPrimary,hasAudienceColumns} from "@/lib/nre/meta-report-content/primary";
import {parseMetaContentSource} from "@/lib/nre/meta-report-content/data";
import {detectCsvCurrency} from "@/lib/nre/csv-currency";
import type {MetaReportContent} from "@/lib/nre/meta-report-content/types";
import { campaignSelectionSpend } from "@/lib/nre/campaign-selection-spend";
import { resolveReportCurrencySymbol } from "@/lib/nre/csv-currency";
import { CURRENCY_SYMBOLS } from "@/lib/nre/format";
import { buildCsvMetricHeaderProfile } from "@/lib/nre/csv-metric-evidence";
import { alignCsvReportFormData } from "@/lib/nre/csv-reporting-calendar";
import { enforceWizardLimits } from "@/lib/usage-rate-limit";
import { requireActiveSubscription } from "@/lib/subscription-guard";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateMtdDailyCsv } from "@/lib/nre/validate";
import { extractCampaignNames, sortCampaignsBySpend, type CampaignSelectionMemory } from "@/lib/nre/campaigns";
import { extractSpendingAdSetGroups } from "@/lib/nre/ad-sets";
import { resolveDefaultSelectedAdSets, newAdSetSlideKeys } from "@/lib/nre/ad-set-slide-preferences";
import { analyzeCsvDateGuidance } from "@/lib/nre/csv-date-guidance";
import { validateComparisonReportCoverage } from "@/lib/nre/comparison-coverage";
import { loadPreviousMonthDataRowsForCampaigns } from "@/lib/nre/previous-month-data";
import { computeCsvDateBounds } from "@/lib/nre/date-range";
import { computeWizardUploadDateContext } from "@/lib/nre/wizard-upload-date-context";
import { hasAdLevelData } from "@/lib/nre/ad-level";
import { apiErrorResponse } from "@/lib/api-error";
import { fileFromFormData } from "@/lib/http-file";
import {
  campaignSelectionMemorySchema,
  comparisonPeriodSchema,
  dateSelectionSchema,
  metaAdAccountIdSchema,
  metaCampaignPeriodReachMapsSchema,
  parseJsonFormField,
  platformSchema,
  reportTypeSchema,
  type DateSelection,
} from "@/lib/validators/report-wizard";
import { detectPlatform } from "@/lib/nre/google-columns";
import { parseUploadedFileHeadersAndRows } from "@/lib/nre/parse-file";
import { parseMtdCsvForAdPlatform } from "@/lib/nre/tiktok-columns";
import { tryFetchMetaCustomConversionResultTypesForUser } from "@/lib/nre/meta-custom-conversion-catalog";
import { hashUploadBuffer, saveWizardUploadSession } from "@/lib/nre/wizard-upload-session";

// Large day-wise exports need time for validation and parsed-session storage.
export const maxDuration = 300;

const DEFAULT_DATE_SELECTION: DateSelection = { mode: "last7" };

/**
 * Step 1+2 of the report upload wizard in one round trip: parses and
 * validates the CSV, lists its campaigns, computes the weekly/MTD date
 * options, and returns the client's saved preferences (if any) so the
 * wizard can pre-select the same campaigns/date mode as last time.
 *
 * Platform (Meta vs Google Ads) is auto-detected from the CSV's own
 * headers (see google-columns.ts's detectPlatform), unless the wizard
 * passes an explicit `platform` field (the user manually overrode the
 * badge). Google Ads reports use a deliberately simpler pipeline than
 * Meta's for this first pass — no campaign-selection or date-range steps,
 * always the full MTD dataset — so a GOOGLE response's `campaignStepMode`
 * is unused by the wizard (it goes straight to the preview regardless);
 * "choose" is just a harmless placeholder value.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const subscriptionGuard = await requireActiveSubscription(session.user.id);
  if (subscriptionGuard) return subscriptionGuard;
  const throttle = await enforceWizardLimits(session.user.id, "upload");
  if (throttle) return throttle;

  try {
    const { id } = await params;
    const client = await prisma.client.findUnique({ where: { id } });
    if (!client || client.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const formData = await req.formData().catch(() => null);
    const mtdDailyBuffer = formData ? await fileFromFormData(formData, "mtdDailyCsv") : null;
    if (!mtdDailyBuffer || mtdDailyBuffer.length === 0) {
      return NextResponse.json(
        { valid: false, errors: [{ field: "mtdDailyCsv", message: "MTD Daily CSV is required." }], warnings: [] },
        { status: 200 },
      );
    }

    const { headers } = parseUploadedFileHeadersAndRows(mtdDailyBuffer, "MTD Daily CSV");
    const platformOverride = formData ? parseJsonFormField(formData, "platform", platformSchema) : undefined;
    const detectedPlatform = detectPlatform(headers);
    const platform = platformOverride ?? detectedPlatform;

    let mtdParsed = parseMtdCsvForAdPlatform(mtdDailyBuffer, platform);
    const reportSelection=formData?parseJsonFormField(formData,"reportSelection",metaReportSelectionSchema):undefined;
    if(formData?.has("reportSelection")&&!reportSelection)return NextResponse.json({valid:false,errors:[{field:"reportSelection",message:"Choose a valid Breakdown or Creative report."}],warnings:[]});
    if(reportSelection&&platform!=="META")return NextResponse.json({valid:false,errors:[{field:"platform",message:"Breakdown and Creative reports are available for Meta."}],warnings:[]});
    const isApiImport=!!formData?.get("metaAdAccountId");
    let metaReportContent:MetaReportContent|undefined;
    if(hasAudienceColumns(mtdParsed.headers)&&!reportSelection)return NextResponse.json({valid:false,errors:[{field:"reportSelection",message:"Choose Breakdown on Import and select the matching audience view before uploading this CSV."}],warnings:[]});
    if(platform === "META" && (hasAudienceColumns(mtdParsed.headers)||reportSelection&&!isApiImport)){
      const type=formData?parseJsonFormField(formData,"reportType",reportTypeSchema):undefined;
      if(type && !["WEEKLY","MONTHLY","HISTORICAL"].includes(type))return NextResponse.json({valid:false,errors:[{field:"reportType",message:"Audience reports are available with Weekly or Monthly dates. Choose one of those report types."}],warnings:[]});
      try {
      const currency=detectCsvCurrency(mtdParsed.headers,mtdParsed.rows);if(currency.error)throw Error(currency.error);
      const source=parseMetaContentSource(mtdParsed,currency.code??client.currency);
      if(reportSelection)assertMetaReportSource(reportSelection,source);
      const converted=audienceOnlyPrimary(source);mtdParsed=converted.parsed;metaReportContent=converted.content;
      if(reportSelection){metaReportContent.selection=reportSelection;metaReportContent.options=metaReportOptions(reportSelection);metaReportContent.notices=[];}
      } catch(error) {return NextResponse.json({valid:false,errors:[{field:"reportContent",message:error instanceof Error?error.message:"Could not read this audience export."}],warnings:[]});}
    }
    if(reportSelection){try{standaloneMetaRange(mtdParsed.rows,parseJsonFormField(formData!,"dateSelection",dateSelectionSchema),client.timezone);}catch(error){return NextResponse.json({valid:false,errors:[{field:"dateSelection",message:(error as Error).message}],warnings:[]});}}
    alignCsvReportFormData(formData, mtdParsed.rows, client.timezone);
    const metaAdAccountIdEarly = formData
      ? parseJsonFormField(formData, "metaAdAccountId", metaAdAccountIdSchema)
      : undefined;
    const metaCustomConversionResultTypes =
      platform === "META"
        ? await tryFetchMetaCustomConversionResultTypesForUser(session.user.id, metaAdAccountIdEarly, id)
        : undefined;
    const requestedReportType = formData ? parseJsonFormField(formData, "reportType", reportTypeSchema) : undefined;
    const validation = validateMtdDailyCsv(
      mtdParsed.colMap,
      mtdParsed.rows,
      undefined,
      mtdParsed.headers,
      platform,
      metaCustomConversionResultTypes,
      requestedReportType,
    );
    if (!validation.valid) {
      return NextResponse.json(
        {
          valid: false,
          errors: validation.errors,
          warnings: validation.warnings,
          detectedPlatform,
          platform,
          // The wizard's PreviousMonthSummaryOption replaces the hard
          // NO_DATA_ROWS_MESSAGE error with a "generate from Previous Month
          // Data instead" offer whenever both are true.
          noCampaignData: validation.noCampaignData,
          hasPreviousMonthData: !!client.previousMonthDataUrl,
        },
        { status: 200 },
      );
    }

    let campaignMemory: CampaignSelectionMemory | null = null;
    if (client.lastDeselectedCampaigns) {
      const parsed = campaignSelectionMemorySchema.safeParse(JSON.parse(client.lastDeselectedCampaigns));
      if (parsed.success) campaignMemory = parsed.data;
    }
    // Optional slides restore explicit choices shared by CSV and API imports.
    const adSetGroups = extractSpendingAdSetGroups(mtdParsed.rows);

    let dateSelection: DateSelection = DEFAULT_DATE_SELECTION;
    if (client.lastDateSelection) {
      const parsed = dateSelectionSchema.safeParse(JSON.parse(client.lastDateSelection));
      if (parsed.success) dateSelection = parsed.data;
    }

    const { dateBounds, weeklyOptions, mtdRange, monthComparisonOptions, dailyRange } = computeWizardUploadDateContext(
      mtdParsed.rows,
      client.timezone,
    );
    if (requestedReportType === "COMPARISON" && formData) {
      const a = parseJsonFormField(formData, "comparisonPeriodA", comparisonPeriodSchema);
      const b = parseJsonFormField(formData, "comparisonPeriodB", comparisonPeriodSchema);
      if (a && b && dateBounds) {
        const coverage = validateComparisonReportCoverage(a, b, dateBounds, null);
        if (!coverage.valid) return NextResponse.json({ valid: false, errors: [{ field: "comparisonPeriod", message: `${coverage.error} Export one Day-wise breakdown CSV covering both selected periods, or change the dates above.` }], warnings: [], detectedPlatform, platform });
      }
    }
    const requestedDates = formData ? parseJsonFormField(formData, "dateSelection", dateSelectionSchema) : undefined;
    if (requestedDates) dateSelection = requestedDates;
    let spendContext;
    try {
      spendContext = campaignSelectionSpend(mtdParsed.rows, {
        reportType: requestedReportType ?? "WEEKLY", dateSelection,
        comparisonPeriodA: formData ? parseJsonFormField(formData,"comparisonPeriodA",comparisonPeriodSchema) : undefined,
        comparisonPeriodB: formData ? parseJsonFormField(formData,"comparisonPeriodB",comparisonPeriodSchema) : undefined,
        historicalMonthCount: formData ? Number(formData.get("historicalMonthCount")) || 1 : 1,
      }, client.timezone, new Date(), campaignMemory);
    } catch (error) {
      return NextResponse.json({valid:false,errors:[{field:"dateSelection",message:(error as Error).message}],warnings:[],detectedPlatform,platform});
    }
    const {campaignSpend,selectedCampaigns,campaignStepMode,zeroSpendCampaigns,campaignSpendLabel} = spendContext;
    const campaigns = sortCampaignsBySpend(extractCampaignNames(mtdParsed.rows), campaignSpend);
    const hasAdLevelCsv = hasAdLevelData(mtdParsed.headers);
    const csvDateGuidance = (requestedReportType ?? "WEEKLY") === "WEEKLY" && !mtdParsed.rows.some(row => row._reportPeriod) ? analyzeCsvDateGuidance(mtdParsed.rows, new Date(), client.timezone) : null;

    const supplementalRows = await loadPreviousMonthDataRowsForCampaigns(client, selectedCampaigns);
    const supplementalBounds = supplementalRows?.length ? computeCsvDateBounds(supplementalRows) : null;
    const monthComparisonCoverage =
      dateBounds && monthComparisonOptions
        ? validateComparisonReportCoverage(
            monthComparisonOptions.periodA,
            monthComparisonOptions.periodB,
            dateBounds,
            supplementalBounds,
          )
        : null;

    const metaCampaignPeriodReach = formData
      ? parseJsonFormField(formData, "metaCampaignPeriodReach", metaCampaignPeriodReachMapsSchema)
      : undefined;
    const metaAdAccountId = metaAdAccountIdEarly;

    const uploadSessionId = await saveWizardUploadSession({
      metaReportContent,
      reportSelection,
      userId: session.user.id,
      clientId: id,
      platform,
      colMap: mtdParsed.colMap,
      rows: mtdParsed.rows,
      headers: mtdParsed.headers,
      fileHash: hashUploadBuffer(mtdDailyBuffer),
      metaCampaignPeriodReach,
      metaAdAccountId,
      metaCustomConversionResultTypes,
    });

    return NextResponse.json({
      valid: true,
      sourceContentOnly:metaReportContent?.sourceOnly??false,
      reportContentPrepared:!!metaReportContent,
      errors: [],
      warnings: validation.warnings,
      detectedPlatform,
      platform,
      uploadSessionId,
      currencySymbol: resolveReportCurrencySymbol(mtdParsed.headers, mtdParsed.rows, CURRENCY_SYMBOLS[client.currency]),
      headers: mtdParsed.headers,
      metricHeaderProfile: buildCsvMetricHeaderProfile(mtdParsed.headers,mtdParsed.rows),
      campaigns,
      campaignSpend,
      detailCampaigns: spendContext.detailCampaigns,
      selectedCampaigns,
      campaignStepMode,
      lowSpendCampaigns: zeroSpendCampaigns,
      zeroSpendCampaigns,
      campaignSpendLabel,
      adSetGroups,
      selectedAdSets: resolveDefaultSelectedAdSets(adSetGroups, client.lastDeselectedAdSets),
      newAdSetKeys: newAdSetSlideKeys(adSetGroups, client.lastDeselectedAdSets),
      dateBounds,
      weeklyOptions,
      mtdRange,
      monthComparisonOptions,
      monthComparisonCoverage,
      previousMonthDataStatus: client.previousMonthDataUrl ? "uploaded" : "missing",
      dailyRange,
      hasAdLevelCsv,
      dateSelection,
      csvDateGuidance,
      metaCsvExportProfile: validation.metaCsvExportProfile ?? null,
    });
  } catch (err) {
    return apiErrorResponse(err, "reports:analyze");
  }
}
