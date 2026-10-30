import { recoveryContextKey, buildPrivateDiagnostics } from "@/lib/quality-agents/recovery-diagnostics";
import { captureCsvQualityIncident } from "@/lib/quality-agents/incidents";
import { assertReportComplexity } from "@/lib/report-complexity";
import { enforceWizardLimits } from "@/lib/usage-rate-limit";
import { requireActiveSubscription } from "@/lib/subscription-guard";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveWizardMtdFromFormData } from "@/lib/nre/resolve-wizard-upload";
import { validateMtdDailyCsv } from "@/lib/nre/validate";
import { createReportEngine } from "@/lib/nre/report-engine";
import { buildStandardReportForWizard } from "@/lib/nre/report-engine/build-standard-from-wizard";
import { computeWizardStandardReportFingerprint } from "@/lib/nre/wizard-report-config-fingerprint";
import { saveWizardPreviewReportCache, scheduleWizardPreviewAiWarm } from "@/lib/nre/wizard-preview-cache";
import {
  reconcileComparisonReportWithCsv,
  reconcileDayBreakdownReportWithCsv,
  reconcileHistoricalReportWithCsv,
} from "@/lib/nre/csv-report-reconciliation";
import { verifyStandardWizardReportAgainstCsv } from "@/lib/nre/wizard-csv-verification";
import { resolveCsvAlignResults } from "@/lib/validators/report-wizard";
import { resolveDateSelection } from "@/lib/nre/resolve-date-selection";
import { validateHistoricalReportInput } from "@/lib/nre/historical-report-data";
import { validateDayBreakdownReportInput } from "@/lib/nre/day-breakdown-report-data";
import { adsManagerName } from "@/lib/nre/platform-reporting";
import { CURRENCY_SYMBOLS } from "@/lib/nre/format";
import { apiErrorResponse } from "@/lib/api-error";
import { loadPreviousMonthDataRows, loadPreviousMonthDataRowsForCampaigns } from "@/lib/nre/previous-month-data";
import { validateComparisonReportCoverage } from "@/lib/nre/comparison-coverage";
import { hasAdLevelData } from "@/lib/nre/ad-level";
import { computeCsvDateBounds } from "@/lib/nre/date-range";
import { parseObjectiveCache } from "@/lib/nre/objective-cache";
import {
  campaignMetricOverridesSchema,
  campaignObjectivesSchema,
  comparisonPeriodSchema,
  dateSelectionSchema,
  historicalMonthCountSchema,
  parseJsonFormField,
  reportTypeSchema,
  resolveIncludePreviousMonthComparison,
  selectedCampaignsSchema,
  selectedMetricsSchema,
} from "@/lib/validators/report-wizard";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const subscriptionGuard = await requireActiveSubscription(session.user.id);
  if (subscriptionGuard) return subscriptionGuard;
  const throttle = await enforceWizardLimits(session.user.id, "work");
  if (throttle) return throttle;

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
  const resolved = await resolveWizardMtdFromFormData(formData, { userId: session.user.id, clientId: id });
  if (!resolved.ok) {
    if ("valid" in resolved.body && resolved.body.valid === false) {
      return NextResponse.json(
        {
          ...resolved.body,
          hasPreviousMonthData: !!client.previousMonthDataUrl,
        },
        { status: resolved.status },
      );
    }
    return NextResponse.json(resolved.body, { status: resolved.status });
  }
  const { parsed: mtdParsed, metaCampaignPeriodReach, metaAdAccountId, uploadSessionId, fileHash } = resolved.data;
  const platform = mtdParsed.platform;
  const parsedReportType = formData ? parseJsonFormField(formData, "reportType", reportTypeSchema) : undefined;
  const validation = validateMtdDailyCsv(mtdParsed.colMap, mtdParsed.rows, undefined, mtdParsed.headers, platform, undefined, parsedReportType);
  const selectedMetrics = formData ? parseJsonFormField(formData, "selectedMetrics", selectedMetricsSchema) : undefined;

  const selectedCampaigns = formData ? parseJsonFormField(formData, "selectedCampaigns", selectedCampaignsSchema) : undefined;
  const campaignObjectives = formData ? parseJsonFormField(formData, "campaignObjectives", campaignObjectivesSchema) : undefined;
  const campaignMetricOverrides = formData ? parseJsonFormField(formData, "campaignMetricOverrides", campaignMetricOverridesSchema) : undefined;
  // PREVIOUS_MONTH_SUMMARY never reaches a preview — the wizard's
  // PreviousMonthSummaryOption calls the generate route directly, skipping
  // this route entirely (see report-data.ts's own doc comment on
  // buildPreviousMonthSummaryReportData). Narrow defensively rather than
  // widening buildReportData's own ReportType to match.

  if (parsedReportType === "COMPARISON") {
    const periodA = formData ? parseJsonFormField(formData, "comparisonPeriodA", comparisonPeriodSchema) : undefined;
    const periodB = formData ? parseJsonFormField(formData, "comparisonPeriodB", comparisonPeriodSchema) : undefined;
    if (!periodA || !periodB) {
      return NextResponse.json(
        { valid: false, errors: [{ field: "comparisonPeriod", message: "Both comparison periods are required." }], warnings: [] },
        { status: 200 },
      );
    }

    const includePreviousMonthComparison = resolveIncludePreviousMonthComparison(formData);
    const primaryBounds = computeCsvDateBounds(mtdParsed.rows);
    const supplementalRows = includePreviousMonthComparison
      ? await loadPreviousMonthDataRowsForCampaigns(client, selectedCampaigns ?? null)
      : undefined;
    const supplementalBounds = supplementalRows?.length ? computeCsvDateBounds(supplementalRows) : null;
    const coverage = validateComparisonReportCoverage(
      { startIso: periodA.startIso, endIso: periodA.endIso },
      { startIso: periodB.startIso, endIso: periodB.endIso },
      primaryBounds,
      supplementalBounds,
    );
    if (!coverage.valid) {
      return NextResponse.json(
        {
          valid: false,
          errors: [{ field: "comparisonPeriod", message: coverage.error ?? "Comparison periods are not covered by your CSV." }],
          warnings: [],
        },
        { status: 200 },
      );
    }

    const comparisonWarnings = [...validation.warnings];
    if (coverage.warning) {
      comparisonWarnings.push({ field: "comparisonPeriod", message: coverage.warning });
    }

    const comparisonEngine = createReportEngine(platform);
    const data = comparisonEngine.buildComparison({
      accountName: client.accountName,
      currencySymbol: CURRENCY_SYMBOLS[client.currency],
      timezone: client.timezone,
      mtdDailyRows: mtdParsed.rows,
      periodBSupplementalRows: supplementalRows,
      selectedCampaigns: selectedCampaigns ?? null,
      periodA: { startIso: periodA.startIso, endIso: periodA.endIso },
      periodB: { startIso: periodB.startIso, endIso: periodB.endIso },
      platform,
      csvHeaders: mtdParsed.headers,
    });

    const csvAlign = resolveCsvAlignResults(formData);
    const csvVerification = reconcileComparisonReportWithCsv({
      report: data,
      mtdDailyRows: mtdParsed.rows,
      periodBSupplementalRows: supplementalRows,
      selectedCampaigns: selectedCampaigns ?? null,
      periodA: { startIso: periodA.startIso, endIso: periodA.endIso },
      periodB: { startIso: periodB.startIso, endIso: periodB.endIso },
      currencySymbol: CURRENCY_SYMBOLS[client.currency],
      resultCountingMode: csvAlign ? "meta-csv-export" : "standard",
      campaignObjectives: campaignObjectives ?? null,
      platform,
    });

    await captureCsvQualityIncident({ userId: session.user.id, contextKey: recoveryContextKey(`${id}:${fileHash ?? uploadSessionId ?? "preview"}`, formData, client.timezone, client), clientId: id, diagnostics: buildPrivateDiagnostics(mtdParsed.rows, mtdParsed.colMap, csvVerification), recheckIncidentId: typeof formData?.get("recoveryIncidentId") === "string" ? String(formData.get("recoveryIncidentId")) : undefined, platform, reportType: parsedReportType ?? "WEEKLY" }, csvVerification);

    return NextResponse.json({
      valid: true,
      errors: [],
      warnings: comparisonWarnings,
      isComparison: true,
      data,
      csvVerification,
      suggestCsvAlign: Boolean(csvVerification.canAlignWithCsvExport && !csvAlign),
    });
  }

  if (parsedReportType === "HISTORICAL") {
    const monthCount =
      formData ? parseJsonFormField(formData, "historicalMonthCount", historicalMonthCountSchema) : undefined;
    const resolvedMonthCount = monthCount ?? 4;
    const historicalSelection = formData ? parseJsonFormField(formData, "dateSelection", dateSelectionSchema) : undefined;
    const coverage = validateHistoricalReportInput(mtdParsed.rows, resolvedMonthCount, new Date(), client.timezone, historicalSelection);
    if (!coverage.valid) {
      return NextResponse.json(
        {
          valid: false,
          errors: [{ field: "historicalMonthCount", message: coverage.error ?? "CSV does not cover the selected months." }],
          warnings: [],
        },
        { status: 200 },
      );
    }

    const historicalEngine = createReportEngine(platform);
    const data = historicalEngine.buildHistorical({
      accountName: client.accountName,
      currencySymbol: CURRENCY_SYMBOLS[client.currency],
      timezone: client.timezone,
      monthlyBudget: client.monthlyBudget,
      mtdDailyRows: mtdParsed.rows,
      selectedCampaigns: selectedCampaigns ?? null,
      selectedMetrics,
      campaignObjectives,
      campaignMetricOverrides,
      objectiveCache: parseObjectiveCache(client.campaignObjectiveCache),
      monthCount: resolvedMonthCount,
      dateSelection: historicalSelection,
      platform,
    });

    const csvAlign = resolveCsvAlignResults(formData);
    const csvVerification = reconcileHistoricalReportWithCsv({
      report: data,
      mtdDailyRows: mtdParsed.rows,
      selectedCampaigns: selectedCampaigns ?? null,
      currencySymbol: CURRENCY_SYMBOLS[client.currency],
      resultCountingMode: csvAlign ? "meta-csv-export" : "standard",
      campaignObjectives: campaignObjectives ?? null,
      platform,
    });

    await captureCsvQualityIncident({ userId: session.user.id, contextKey: recoveryContextKey(`${id}:${fileHash ?? uploadSessionId ?? "preview"}`, formData, client.timezone, client), clientId: id, diagnostics: buildPrivateDiagnostics(mtdParsed.rows, mtdParsed.colMap, csvVerification), recheckIncidentId: typeof formData?.get("recoveryIncidentId") === "string" ? String(formData.get("recoveryIncidentId")) : undefined, platform, reportType: parsedReportType ?? "WEEKLY" }, csvVerification);

    return NextResponse.json({
      valid: true,
      errors: [],
      warnings: validation.warnings,
      isHistorical: true,
      data,
      csvVerification,
      suggestCsvAlign: Boolean(csvVerification.canAlignWithCsvExport && !csvAlign),
    });
  }

  if (parsedReportType === "DAY_BREAKDOWN") {
    if (platform !== "META") {
      return NextResponse.json(
        {
          valid: false,
          errors: [{ field: "reportType", message: "Daily table reports are available for Meta only in this version." }],
          warnings: [],
        },
        { status: 200 },
      );
    }

    const dateSelection = formData ? parseJsonFormField(formData, "dateSelection", dateSelectionSchema) : undefined;
    const dateResolution = resolveDateSelection(mtdParsed.rows, dateSelection, new Date(), client.timezone);
    if (!dateResolution.ok || !dateResolution.weeklyRange) {
      return NextResponse.json(
        {
          valid: false,
          errors: [{ field: "dateSelection", message: dateResolution.error ?? "Choose a valid date range." }],
          warnings: [],
        },
        { status: 200 },
      );
    }

    const coverage = validateDayBreakdownReportInput(mtdParsed.rows, dateResolution.weeklyRange);
    if (!coverage.valid) {
      return NextResponse.json(
        {
          valid: false,
          errors: [{ field: "dateSelection", message: coverage.error ?? "CSV does not cover the selected dates." }],
          warnings: [],
        },
        { status: 200 },
      );
    }

    const dayBreakdownEngine = createReportEngine(platform);
    const data = dayBreakdownEngine.buildDayBreakdown({
      accountName: client.accountName,
      currencySymbol: CURRENCY_SYMBOLS[client.currency],
      timezone: client.timezone,
      mtdDailyRows: mtdParsed.rows,
      dateRange: dateResolution.weeklyRange,
      selectedCampaigns: selectedCampaigns ?? null,
      selectedMetrics,
      campaignObjectives,
      campaignMetricOverrides,
      objectiveCache: parseObjectiveCache(client.campaignObjectiveCache),
      platform,
    });

    const csvAlign = resolveCsvAlignResults(formData);
    const csvVerification = reconcileDayBreakdownReportWithCsv({
      report: data,
      mtdDailyRows: mtdParsed.rows,
      selectedCampaigns: selectedCampaigns ?? null,
      currencySymbol: CURRENCY_SYMBOLS[client.currency],
      resultCountingMode: csvAlign ? "meta-csv-export" : "standard",
      campaignObjectives: campaignObjectives ?? null,
      platform,
    });

    await captureCsvQualityIncident({ userId: session.user.id, contextKey: recoveryContextKey(`${id}:${fileHash ?? uploadSessionId ?? "preview"}`, formData, client.timezone, client), clientId: id, diagnostics: buildPrivateDiagnostics(mtdParsed.rows, mtdParsed.colMap, csvVerification), recheckIncidentId: typeof formData?.get("recoveryIncidentId") === "string" ? String(formData.get("recoveryIncidentId")) : undefined, platform, reportType: parsedReportType ?? "WEEKLY" }, csvVerification);

    return NextResponse.json({
      valid: true,
      errors: [],
      warnings: validation.warnings,
      isDayBreakdown: true,
      data,
      csvVerification,
      suggestCsvAlign: Boolean(csvVerification.canAlignWithCsvExport && !csvAlign),
    });
  }

  if (parsedReportType === "CREATIVE" && !hasAdLevelData(mtdParsed.headers)) {
    return NextResponse.json(
      {
        valid: false,
        errors: [
          {
            field: "mtdDailyCsv",
            message:
              `Creative reporting requires an Ad-level CSV with an Ad Name column. Export from ${adsManagerName(platform)} → Ads tab.`,
          },
        ],
        warnings: [],
      },
      { status: 200 },
    );
  }

  const built = await buildStandardReportForWizard({
    client,
    mtdParsed,
    formData,
    platform,
    metaCampaignPeriodReachFromSession: metaCampaignPeriodReach,
    metaAdAccountIdFromSession: metaAdAccountId,
  });
  if ("error" in built) {
    const field =
      built.error.includes("date") || built.error.includes("yesterday")
        ? "dateSelection"
        : "mtdDailyCsv";
    return NextResponse.json(
      { valid: false, errors: [{ field, message: built.error }], warnings: [] },
      { status: 200 },
    );
  }

  try { assertReportComplexity(built.data); } catch (err) { return apiErrorResponse(err, "reports:preview:complexity"); }
  const reportType = built.data.reportType;
  const previewNow = new Date();
  const includePreviousMonthComparison = resolveIncludePreviousMonthComparison(formData);
  const periodRowsForVerify = includePreviousMonthComparison
    ? await loadPreviousMonthDataRows(client)
    : undefined;
  const csvAlign = resolveCsvAlignResults(formData);

  if (uploadSessionId && fileHash) {
    try {
      const fingerprint = computeWizardStandardReportFingerprint({
        fileHash,
        client,
        platform,
        formData,
      });
      await saveWizardPreviewReportCache({
        userId: session.user.id,
        clientId: id,
        sessionId: uploadSessionId,
        fingerprint,
        reportData: built.data,
      });

    } catch (err) {
      console.error("[reports:preview] preview cache save failed:", err);
    }
  }

  const csvVerification = verifyStandardWizardReportAgainstCsv({
    client,
    mtdRows: mtdParsed.rows,
    report: built.data,
    reportType,
    formData,
    platform,
    now: previewNow,
    periodRows: periodRowsForVerify,
  });

  await captureCsvQualityIncident({ userId: session.user.id, contextKey: recoveryContextKey(`${id}:${fileHash ?? uploadSessionId ?? "preview"}`, formData, client.timezone, client), clientId: id, diagnostics: buildPrivateDiagnostics(mtdParsed.rows, mtdParsed.colMap, csvVerification), recheckIncidentId: typeof formData?.get("recoveryIncidentId") === "string" ? String(formData.get("recoveryIncidentId")) : undefined, platform, reportType: parsedReportType ?? "WEEKLY" }, csvVerification);

  // Never spend insight-generation calls on a known mismatch or an automatic recovery recheck.
  if (csvVerification.status === "ok" && !formData?.get("recoveryIncidentId") && uploadSessionId && fileHash) {
    scheduleWizardPreviewAiWarm({userId:session.user.id,clientId:id,sessionId:uploadSessionId,fingerprint:computeWizardStandardReportFingerprint({fileHash,client,platform,formData}),reportData:built.data});
  }

  return NextResponse.json({
    valid: true,
    errors: [],
    warnings: validation.warnings,
    csvZeroMetricWarnings: [],
    data: built.data,
    csvVerification,
    suggestCsvAlign: Boolean(csvVerification.canAlignWithCsvExport && !csvAlign),
  });
}
