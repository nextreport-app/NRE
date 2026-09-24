import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteReportFile } from "@/lib/storage";
import { resolveWizardMtdFromFormData } from "@/lib/nre/resolve-wizard-upload";
import { scheduleReportGenerationJob } from "@/lib/nre/dispatch-report-generation-job";
import {
  serializeReportGenerationJob,
  type ComparisonReportJobPayload,
  type DayBreakdownReportJobPayload,
  type HistoricalReportJobPayload,
  type PreviousMonthSummaryJobPayload,
  type StandardReportJobPayload,
} from "@/lib/nre/report-generation-job";
import { createReportEngine } from "@/lib/nre/report-engine";
import { buildStandardReportForWizard } from "@/lib/nre/report-engine/build-standard-from-wizard";
import { generateShareToken } from "@/lib/share-token";
import { defaultReportDisplayName } from "@/lib/nre/report-display-name";
import { CURRENCY_SYMBOLS } from "@/lib/nre/format";
import { validateHistoricalReportInput } from "@/lib/nre/historical-report-data";
import { validateDayBreakdownReportInput } from "@/lib/nre/day-breakdown-report-data";
import { resolveDateSelection } from "@/lib/nre/resolve-date-selection";
import { apiErrorResponse } from "@/lib/api-error";
import { requireActiveSubscription } from "@/lib/subscription-guard";
import { loadPreviousMonthDataRows, loadPreviousMonthDataRowsForCampaigns } from "@/lib/nre/previous-month-data";
import { validateComparisonReportCoverage } from "@/lib/nre/comparison-coverage";
import { computeCsvDateBounds } from "@/lib/nre/date-range";
import { mergeObjectiveCache, parseObjectiveCache } from "@/lib/nre/objective-cache";
import {
  campaignMetricOverridesSchema,
  campaignObjectivesSchema,
  comparisonPeriodSchema,
  confirmedCampaignObjectivesSchema,
  dateSelectionSchema,
  historicalMonthCountSchema,
  parseJsonFormField,
  platformSchema,
  reportTitleSchema,
  reportTypeSchema,
  selectedCampaignsSchema,
  selectedMetricsSchema,
  uploadSessionIdSchema,
  resolveIncludePreviousMonthComparison,
} from "@/lib/validators/report-wizard";

function enqueueResponse(reportId: string, shareToken?: string | null) {
  return NextResponse.json({
    ok: true,
    reportId,
    shareToken: shareToken ?? undefined,
    status: "GENERATING" as const,
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  let client;
  try {
    client = await prisma.client.findUnique({ where: { id } });
  } catch (err) {
    return apiErrorResponse(err, "reports:generate:lookup");
  }
  if (!client || client.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const guardResponse = await requireActiveSubscription(session.user.id);
  if (guardResponse) return guardResponse;

  const formData = await req.formData().catch(() => null);
  const reportTitle = formData ? parseJsonFormField(formData, "reportTitle", reportTitleSchema) : undefined;
  const reportType = formData ? parseJsonFormField(formData, "reportType", reportTypeSchema) : undefined;
  const platformOverride = formData ? parseJsonFormField(formData, "platform", platformSchema) : undefined;

  const uploadSessionIdFromForm = formData
    ? parseJsonFormField(formData, "uploadSessionId", uploadSessionIdSchema)
    : undefined;

  const confirmedCampaignObjectives = formData
    ? parseJsonFormField(formData, "confirmedCampaignObjectives", confirmedCampaignObjectivesSchema)
    : undefined;
  if (confirmedCampaignObjectives && Object.keys(confirmedCampaignObjectives).length > 0) {
    prisma.client
      .update({
        where: { id: client.id },
        data: { campaignObjectiveCache: mergeObjectiveCache(client.campaignObjectiveCache, confirmedCampaignObjectives) },
      })
      .catch((err) => {
        console.error("[api:reports:generate] failed to update campaign objective cache:", err);
      });
  }

  if (reportType === "PREVIOUS_MONTH_SUMMARY") {
    const platform = platformOverride ?? "META";
    if (!client.previousMonthDataUrl) {
      return NextResponse.json({ error: "This client has no Previous Month Data on file." }, { status: 400 });
    }
    const periodRows = await loadPreviousMonthDataRows(client);
    if (!periodRows || periodRows.length === 0) {
      return NextResponse.json({ error: "Previous Month Data has no usable rows." }, { status: 400 });
    }

    const currencySymbol = CURRENCY_SYMBOLS[client.currency];
    const summaryEngine = createReportEngine(platform);
    const summaryData = summaryEngine.buildPreviousMonthSummary({
      accountName: client.accountName,
      currencySymbol,
      timezone: client.timezone,
      periodRows,
      platform,
    });

    const fileName = `Previous Month Summary - ${summaryData.periodRow.fullMonthLabel}.pptx`.replace(/[\s/]/g, "_");
    const shareToken = generateShareToken();

    let summaryReport;
    try {
      const jobPayload: PreviousMonthSummaryJobPayload = {
        version: 1,
        kind: "PREVIOUS_MONTH_SUMMARY",
        userId: session.user.id,
        clientId: id,
        uploadSessionId: uploadSessionIdFromForm,
        platform,
        summaryData,
        shareToken,
      };

      summaryReport = await prisma.report.create({
        data: {
          clientId: client.id,
          status: "GENERATING",
          reportType: "MONTHLY",
          platform,
          fileName,
          displayName: `Previous Month Summary — ${summaryData.periodRow.fullMonthLabel}`,
          shareToken,
          summaryJson: JSON.stringify({
            isPaused: false,
            previousMonthSummaryOnly: true,
            healthScore: summaryData.cover.healthScore,
            healthBadge: summaryData.cover.healthBadge,
            campaignCount: 0,
            adSetCount: 0,
          }),
          jobPayload: serializeReportGenerationJob(jobPayload),
        },
      });
    } catch (err) {
      return apiErrorResponse(err, "reports:generate:create-previous-month-summary");
    }

    scheduleReportGenerationJob(summaryReport.id);
    return enqueueResponse(summaryReport.id, shareToken);
  }

  const resolved = await resolveWizardMtdFromFormData(formData, { userId: session.user.id, clientId: id });
  if (!resolved.ok) {
    return NextResponse.json(resolved.body, { status: resolved.status });
  }
  const { parsed: mtdParsed, uploadSessionId } = resolved.data;
  const platform = mtdParsed.platform;

  if (reportType === "COMPARISON") {
    const selectedCampaigns = formData ? parseJsonFormField(formData, "selectedCampaigns", selectedCampaignsSchema) : undefined;
    const periodA = formData ? parseJsonFormField(formData, "comparisonPeriodA", comparisonPeriodSchema) : undefined;
    const periodB = formData ? parseJsonFormField(formData, "comparisonPeriodB", comparisonPeriodSchema) : undefined;
    if (!periodA || !periodB) {
      return NextResponse.json({ error: "Both comparison periods are required." }, { status: 400 });
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
      return NextResponse.json({ error: coverage.error ?? "Comparison periods are not covered by your CSV." }, { status: 400 });
    }

    const comparisonEngine = createReportEngine(platform);
    const comparisonData = comparisonEngine.buildComparison({
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

    const fileName = `Comparison Report - ${comparisonData.periodALabel} vs ${comparisonData.periodBLabel}.pptx`.replace(/[\s/]/g, "_");

    let comparisonReport;
    try {
      const jobPayload: ComparisonReportJobPayload = {
        version: 1,
        kind: "COMPARISON",
        userId: session.user.id,
        clientId: id,
        uploadSessionId,
        platform,
        reportTitle,
        comparisonData,
      };

      comparisonReport = await prisma.report.create({
        data: {
          clientId: client.id,
          status: "GENERATING",
          reportType: "COMPARISON",
          platform,
          fileName,
          displayName: defaultReportDisplayName(
            "COMPARISON",
            null,
            null,
            `${comparisonData.periodALabel} vs ${comparisonData.periodBLabel}`,
          ),
          summaryJson: JSON.stringify({
            isPaused: comparisonData.isPaused,
            periodALabel: comparisonData.periodALabel,
            periodBLabel: comparisonData.periodBLabel,
            campaignCount: comparisonData.campaigns.length,
          }),
          jobPayload: serializeReportGenerationJob(jobPayload),
        },
      });
    } catch (err) {
      return apiErrorResponse(err, "reports:generate:create-comparison");
    }

    scheduleReportGenerationJob(comparisonReport.id);
    return enqueueResponse(comparisonReport.id);
  }

  if (reportType === "HISTORICAL") {
    const selectedCampaigns = formData ? parseJsonFormField(formData, "selectedCampaigns", selectedCampaignsSchema) : undefined;
    const selectedMetrics = formData ? parseJsonFormField(formData, "selectedMetrics", selectedMetricsSchema) : undefined;
    const campaignObjectives = formData ? parseJsonFormField(formData, "campaignObjectives", campaignObjectivesSchema) : undefined;
    const campaignMetricOverrides = formData
      ? parseJsonFormField(formData, "campaignMetricOverrides", campaignMetricOverridesSchema)
      : undefined;
    const monthCount =
      formData ? parseJsonFormField(formData, "historicalMonthCount", historicalMonthCountSchema) : undefined;
    const resolvedMonthCount = monthCount ?? 4;
    const coverage = validateHistoricalReportInput(mtdParsed.rows, resolvedMonthCount, new Date(), client.timezone);
    if (!coverage.valid) {
      return NextResponse.json({ error: coverage.error ?? "CSV does not cover the selected months." }, { status: 400 });
    }

    const historicalEngine = createReportEngine(platform);
    const historicalData = historicalEngine.buildHistorical({
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

    const fileName = `Multi-Month Report - ${historicalData.monthsLabel}.pptx`.replace(/[\s/]/g, "_");
    const shareToken = generateShareToken();

    let historicalReport;
    try {
      const jobPayload: HistoricalReportJobPayload = {
        version: 1,
        kind: "HISTORICAL",
        userId: session.user.id,
        clientId: id,
        uploadSessionId,
        platform,
        reportTitle,
        historicalData,
        shareToken,
      };

      historicalReport = await prisma.report.create({
        data: {
          clientId: client.id,
          status: "GENERATING",
          reportType: "HISTORICAL",
          platform,
          fileName,
          displayName: defaultReportDisplayName("HISTORICAL", null, null, historicalData.monthsLabel),
          shareToken,
          summaryJson: JSON.stringify({
            isPaused: historicalData.isPaused,
            monthsLabel: historicalData.monthsLabel,
            monthCount: historicalData.monthCount,
            slideCount: historicalData.slides.length,
          }),
          jobPayload: serializeReportGenerationJob(jobPayload),
        },
      });
    } catch (err) {
      return apiErrorResponse(err, "reports:generate:create-historical");
    }

    scheduleReportGenerationJob(historicalReport.id);
    return enqueueResponse(historicalReport.id, shareToken);
  }

  if (reportType === "DAY_BREAKDOWN") {
    if (platform !== "META") {
      return NextResponse.json({ error: "Daily table reports are available for Meta only in this version." }, { status: 400 });
    }

    const selectedCampaigns = formData ? parseJsonFormField(formData, "selectedCampaigns", selectedCampaignsSchema) : undefined;
    const dateSelection = formData ? parseJsonFormField(formData, "dateSelection", dateSelectionSchema) : undefined;
    const dateResolution = resolveDateSelection(mtdParsed.rows, dateSelection, new Date(), client.timezone);
    if (!dateResolution.ok || !dateResolution.weeklyRange) {
      return NextResponse.json({ error: dateResolution.error ?? "Choose a valid date range." }, { status: 400 });
    }

    const coverage = validateDayBreakdownReportInput(mtdParsed.rows, dateResolution.weeklyRange);
    if (!coverage.valid) {
      return NextResponse.json({ error: coverage.error ?? "CSV does not cover the selected dates." }, { status: 400 });
    }

    const dayBreakdownEngine = createReportEngine(platform);
    const dayBreakdownData = dayBreakdownEngine.buildDayBreakdown({
      accountName: client.accountName,
      currencySymbol: CURRENCY_SYMBOLS[client.currency],
      timezone: client.timezone,
      mtdDailyRows: mtdParsed.rows,
      dateRange: dateResolution.weeklyRange,
      selectedCampaigns: selectedCampaigns ?? null,
      platform,
    });

    const fileName = `Daily Report - ${dayBreakdownData.rangeLabel}.pptx`.replace(/[\s/]/g, "_");
    const shareToken = generateShareToken();

    let dayBreakdownReport;
    try {
      const jobPayload: DayBreakdownReportJobPayload = {
        version: 1,
        kind: "DAY_BREAKDOWN",
        userId: session.user.id,
        clientId: id,
        uploadSessionId,
        platform,
        reportTitle,
        dayBreakdownData,
        shareToken,
      };

      dayBreakdownReport = await prisma.report.create({
        data: {
          clientId: client.id,
          status: "GENERATING",
          reportType: "DAY_BREAKDOWN",
          platform,
          fileName,
          displayName: defaultReportDisplayName("DAY_BREAKDOWN", null, null, dayBreakdownData.rangeLabel),
          shareToken,
          summaryJson: JSON.stringify({
            isPaused: dayBreakdownData.isPaused,
            rangeLabel: dayBreakdownData.rangeLabel,
            dayCount: dayBreakdownData.dayCount,
            tableSlideCount: dayBreakdownData.tableSlides.length,
          }),
          jobPayload: serializeReportGenerationJob(jobPayload),
        },
      });
    } catch (err) {
      return apiErrorResponse(err, "reports:generate:create-day-breakdown");
    }

    scheduleReportGenerationJob(dayBreakdownReport.id);
    return enqueueResponse(dayBreakdownReport.id, shareToken);
  }

  const result = await buildStandardReportForWizard({ client, mtdParsed, formData, platform });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  const { data } = result;

  const [weekStart, weekEnd] = data.fileDateRange.includes(" to ")
    ? data.fileDateRange.split(" to ")
    : [undefined, undefined];
  const filePrefix =
    platform === "GOOGLE"
      ? "Google Ads Report - "
      : platform === "TIKTOK"
        ? "TikTok Ads Report - "
        : "Meta Ads Report - ";
  const fileName = filePrefix + data.fileDateRange.replace(/[\s/]/g, "_") + ".pptx";
  const shareToken = generateShareToken();

  let report;
  try {
    const jobPayload: StandardReportJobPayload = {
      version: 1,
      kind: "STANDARD",
      userId: session.user.id,
      clientId: id,
      uploadSessionId,
      platform,
      reportTitle,
      reportData: data,
    };

    report = await prisma.report.create({
      data: {
        clientId: client.id,
        status: "GENERATING",
        reportType: data.reportType,
        platform,
        weekStart,
        weekEnd,
        fileName,
        displayName: defaultReportDisplayName(data.reportType, weekStart, weekEnd),
        shareToken,
        summaryJson: JSON.stringify({
          isPaused: data.isPaused,
          healthScore: data.cover.healthScore,
          healthBadge: data.cover.healthBadge,
          campaignCount: data.campaignSlides.length,
          adSetCount: data.adSetSlides.length,
        }),
        jobPayload: serializeReportGenerationJob(jobPayload),
      },
    });
  } catch (err) {
    return apiErrorResponse(err, "reports:generate:create");
  }

  scheduleReportGenerationJob(report.id);
  return enqueueResponse(report.id, shareToken);
}

const bulkDeleteSchema = z.object({ reportIds: z.array(z.string()).min(1) });

/** Bulk-deletes reports for the report-history list's multi-select — scopes the delete to reports that both match a requested id AND belong to this client (which itself must belong to the current user), the same ownership check as the single-report DELETE route just applied to a whole set at once. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  let client;
  try {
    client = await prisma.client.findUnique({ where: { id } });
  } catch (err) {
    return apiErrorResponse(err, "reports:bulk-delete:lookup");
  }
  if (!client || client.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = bulkDeleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "reportIds is required." }, { status: 400 });
  }

  try {
    const reports = await prisma.report.findMany({
      where: { id: { in: parsed.data.reportIds }, clientId: client.id },
      select: { id: true, filePath: true },
    });

    await Promise.all(reports.filter((r) => r.filePath).map((r) => deleteReportFile(r.filePath!)));
    await prisma.report.deleteMany({ where: { id: { in: reports.map((r) => r.id) } } });

    return NextResponse.json({ ok: true, deletedCount: reports.length });
  } catch (err) {
    return apiErrorResponse(err, "reports:bulk-delete");
  }
}
