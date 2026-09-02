import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseUploadedFile, parseUploadedFileHeadersAndRows } from "@/lib/nre/parse-file";
import { validateMtdDailyCsv } from "@/lib/nre/validate";
import { buildComparisonReportData, buildReportData } from "@/lib/nre/report-data";
import { buildGoogleReportData } from "@/lib/nre/google-report-data";
import { detectPlatform, readGoogleRowsWithAutoMap } from "@/lib/nre/google-columns";
import { validateGoogleAdsCsv } from "@/lib/nre/validate-google";
import { CURRENCY_SYMBOLS } from "@/lib/nre/format";
import { apiErrorResponse } from "@/lib/api-error";
import { fileFromFormData } from "@/lib/http-file";
import { resolveDateSelection } from "@/lib/nre/resolve-date-selection";
import { loadPreviousMonthDataRows } from "@/lib/nre/previous-month-data";
import { detectAdNameColumn, hasAdLevelData } from "@/lib/nre/ad-level";
import { computeDailyRangeIso } from "@/lib/nre/date-range";
import type { ReportType } from "@/lib/nre/report-data";
import { parseObjectiveCache } from "@/lib/nre/objective-cache";
import {
  campaignMetricOverridesSchema,
  campaignObjectivesSchema,
  comparisonPeriodSchema,
  dateSelectionSchema,
  parseJsonFormField,
  platformSchema,
  reportTypeSchema,
  selectedAdSetsSchema,
  selectedCampaignsSchema,
  selectedMetricsSchema,
} from "@/lib/validators/report-wizard";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  let client;
  try {
    client = await prisma.client.findUnique({ where: { id } });
  } catch (err) {
    return apiErrorResponse(err, "reports:preview:lookup");
  }
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

  const { headers, dataRows } = parseUploadedFileHeadersAndRows(mtdDailyBuffer, "MTD Daily CSV");
  const platformOverride = formData ? parseJsonFormField(formData, "platform", platformSchema) : undefined;
  const platform = platformOverride ?? detectPlatform(headers);
  const selectedMetrics = formData ? parseJsonFormField(formData, "selectedMetrics", selectedMetricsSchema) : undefined;

  if (platform === "GOOGLE") {
    const { colMap, rows } = readGoogleRowsWithAutoMap(headers, dataRows);
    const validation = validateGoogleAdsCsv(colMap, rows, undefined, headers);
    if (!validation.valid) {
      return NextResponse.json({ valid: false, errors: validation.errors, warnings: validation.warnings }, { status: 200 });
    }

    const data = buildGoogleReportData({
      accountName: client.accountName,
      currencySymbol: CURRENCY_SYMBOLS[client.currency],
      monthlyBudget: client.monthlyBudget,
      mtdDailyRows: rows,
      selectedMetrics,
    });

    return NextResponse.json({ valid: true, errors: [], warnings: validation.warnings, data });
  }

  const mtdParsed = parseUploadedFile(mtdDailyBuffer, "MTD Daily CSV");
  const validation = validateMtdDailyCsv(mtdParsed.colMap, mtdParsed.rows, undefined, mtdParsed.headers);

  if (!validation.valid) {
    return NextResponse.json(
      {
        valid: false,
        errors: validation.errors,
        warnings: validation.warnings,
        // See analyze/route.ts's own equivalent fields — the wizard's
        // PreviousMonthSummaryOption reads these the same way at whichever
        // step surfaces this error.
        noCampaignData: validation.noCampaignData,
        hasPreviousMonthData: !!client.previousMonthDataUrl,
      },
      { status: 200 },
    );
  }

  const selectedCampaigns = formData ? parseJsonFormField(formData, "selectedCampaigns", selectedCampaignsSchema) : undefined;
  const selectedAdSets = formData ? parseJsonFormField(formData, "selectedAdSets", selectedAdSetsSchema) : undefined;
  const campaignObjectives = formData ? parseJsonFormField(formData, "campaignObjectives", campaignObjectivesSchema) : undefined;
  const campaignMetricOverrides = formData ? parseJsonFormField(formData, "campaignMetricOverrides", campaignMetricOverridesSchema) : undefined;
  // PREVIOUS_MONTH_SUMMARY never reaches a preview — the wizard's
  // PreviousMonthSummaryOption calls the generate route directly, skipping
  // this route entirely (see report-data.ts's own doc comment on
  // buildPreviousMonthSummaryReportData). Narrow defensively rather than
  // widening buildReportData's own ReportType to match.
  const parsedReportType = formData ? parseJsonFormField(formData, "reportType", reportTypeSchema) : undefined;
  let reportType: ReportType = "WEEKLY";
  if (parsedReportType === "MONTHLY") reportType = "MONTHLY";
  else if (parsedReportType === "DAILY") reportType = "DAILY";
  else if (parsedReportType === "CREATIVE") reportType = "CREATIVE";
  else if (parsedReportType === "COMPARISON") {
    const periodA = formData ? parseJsonFormField(formData, "comparisonPeriodA", comparisonPeriodSchema) : undefined;
    const periodB = formData ? parseJsonFormField(formData, "comparisonPeriodB", comparisonPeriodSchema) : undefined;
    if (!periodA || !periodB) {
      return NextResponse.json(
        { valid: false, errors: [{ field: "comparisonPeriod", message: "Both comparison periods are required." }], warnings: [] },
        { status: 200 },
      );
    }

    const data = buildComparisonReportData({
      accountName: client.accountName,
      currencySymbol: CURRENCY_SYMBOLS[client.currency],
      timezone: client.timezone,
      mtdDailyRows: mtdParsed.rows,
      selectedCampaigns: selectedCampaigns ?? null,
      periodA: { startIso: periodA.startIso, endIso: periodA.endIso },
      periodB: { startIso: periodB.startIso, endIso: periodB.endIso },
    });

    return NextResponse.json({ valid: true, errors: [], warnings: validation.warnings, isComparison: true, data });
  }

  if (parsedReportType === "CREATIVE" && !hasAdLevelData(mtdParsed.headers)) {
    return NextResponse.json(
      {
        valid: false,
        errors: [
          {
            field: "mtdDailyCsv",
            message:
              "Creative reporting requires an Ad-level CSV with an Ad Name column. Export from Meta Ads Manager → Ads tab.",
          },
        ],
        warnings: [],
      },
      { status: 200 },
    );
  }

  const dateSelection = formData ? parseJsonFormField(formData, "dateSelection", dateSelectionSchema) : undefined;

  let weeklyRange: { startIso: string; endIso: string } | undefined;
  if (reportType === "DAILY") {
    const daily = computeDailyRangeIso(mtdParsed.rows, new Date(), client.timezone);
    if (!daily) {
      return NextResponse.json(
        { valid: false, errors: [{ field: "dateSelection", message: "Could not determine yesterday from CSV." }], warnings: [] },
        { status: 200 },
      );
    }
    weeklyRange = daily;
  } else if (reportType !== "CREATIVE") {
    const dateResolution = resolveDateSelection(mtdParsed.rows, dateSelection, new Date(), client.timezone);
    if (!dateResolution.ok) {
      return NextResponse.json(
        { valid: false, errors: [{ field: "dateSelection", message: dateResolution.error || "Invalid date selection." }], warnings: [] },
        { status: 200 },
      );
    }
    weeklyRange = dateResolution.weeklyRange;
  }

  const periodRows = await loadPreviousMonthDataRows(client);

  const data = buildReportData({
    accountName: client.accountName,
    currencySymbol: CURRENCY_SYMBOLS[client.currency],
    timezone: client.timezone,
    monthlyBudget: client.monthlyBudget,
    mtdDailyRows: mtdParsed.rows,
    periodRows,
    selectedCampaigns: selectedCampaigns ?? null,
    selectedAdSets: selectedAdSets ?? null,
    weeklyRange,
    reportType,
    selectedMetrics,
    campaignObjectives,
    campaignMetricOverrides,
    objectiveCache: parseObjectiveCache(client.campaignObjectiveCache),
    adNameColumn: detectAdNameColumn(mtdParsed.headers),
    creativeOnly: reportType === "CREATIVE",
  });

  return NextResponse.json({ valid: true, errors: [], warnings: validation.warnings, data });
}
