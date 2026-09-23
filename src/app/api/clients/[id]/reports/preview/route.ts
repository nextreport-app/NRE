import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveWizardMtdFromFormData } from "@/lib/nre/resolve-wizard-upload";
import { validateMtdDailyCsv } from "@/lib/nre/validate";
import { createReportEngine } from "@/lib/nre/report-engine";
import { buildStandardReportForWizard } from "@/lib/nre/report-engine/build-standard-from-wizard";
import { validateHistoricalReportInput } from "@/lib/nre/historical-report-data";
import { validateDayBreakdownReportInput } from "@/lib/nre/day-breakdown-report-data";
import { resolveDateSelection } from "@/lib/nre/resolve-date-selection";
import { adsManagerName } from "@/lib/nre/platform-reporting";
import { CURRENCY_SYMBOLS } from "@/lib/nre/format";
import { apiErrorResponse } from "@/lib/api-error";
import { loadPreviousMonthDataRowsForCampaigns } from "@/lib/nre/previous-month-data";
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
  platformSchema,
  reportTypeSchema,
  resolveIncludePreviousMonthComparison,
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
  const { parsed: mtdParsed } = resolved.data;
  const platform = mtdParsed.platform;
  const validation = validateMtdDailyCsv(mtdParsed.colMap, mtdParsed.rows, undefined, mtdParsed.headers, platform);
  const selectedMetrics = formData ? parseJsonFormField(formData, "selectedMetrics", selectedMetricsSchema) : undefined;

  const selectedCampaigns = formData ? parseJsonFormField(formData, "selectedCampaigns", selectedCampaignsSchema) : undefined;
  const campaignObjectives = formData ? parseJsonFormField(formData, "campaignObjectives", campaignObjectivesSchema) : undefined;
  const campaignMetricOverrides = formData ? parseJsonFormField(formData, "campaignMetricOverrides", campaignMetricOverridesSchema) : undefined;
  // PREVIOUS_MONTH_SUMMARY never reaches a preview — the wizard's
  // PreviousMonthSummaryOption calls the generate route directly, skipping
  // this route entirely (see report-data.ts's own doc comment on
  // buildPreviousMonthSummaryReportData). Narrow defensively rather than
  // widening buildReportData's own ReportType to match.
  const parsedReportType = formData ? parseJsonFormField(formData, "reportType", reportTypeSchema) : undefined;
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

    return NextResponse.json({ valid: true, errors: [], warnings: comparisonWarnings, isComparison: true, data });
  }

  if (parsedReportType === "HISTORICAL") {
    const monthCount =
      formData ? parseJsonFormField(formData, "historicalMonthCount", historicalMonthCountSchema) : undefined;
    const resolvedMonthCount = monthCount ?? 4;
    const coverage = validateHistoricalReportInput(mtdParsed.rows, resolvedMonthCount, new Date(), client.timezone);
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
      platform,
    });

    return NextResponse.json({ valid: true, errors: [], warnings: validation.warnings, isHistorical: true, data });
  }

  if (parsedReportType === "DAY_BREAKDOWN") {
    if (platform !== "META") {
      return NextResponse.json(
        {
          valid: false,
          errors: [{ field: "reportType", message: "Day-by-Day reports are available for Meta only in this version." }],
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

    return NextResponse.json({ valid: true, errors: [], warnings: validation.warnings, isDayBreakdown: true, data });
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

  const built = await buildStandardReportForWizard({ client, mtdParsed, formData, platform });
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

  return NextResponse.json({ valid: true, errors: [], warnings: validation.warnings, data: built.data });
}
