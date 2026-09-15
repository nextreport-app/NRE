import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteReportFile } from "@/lib/storage";
import type { Platform } from "@/lib/nre/google-columns";
import type { ColumnMap, NreRow } from "@/lib/nre/columns";
import { resolveWizardMtdFromFormData } from "@/lib/nre/resolve-wizard-upload";
import { dispatchReportGenerationJob } from "@/lib/nre/dispatch-report-generation-job";
import {
  serializeReportGenerationJob,
  type ComparisonReportJobPayload,
  type HistoricalReportJobPayload,
  type PreviousMonthSummaryJobPayload,
  type StandardReportJobPayload,
} from "@/lib/nre/report-generation-job";
import { buildComparisonReportData, buildPreviousMonthSummaryReportData, buildReportData, type ReportData } from "@/lib/nre/report-data";
import { generateShareToken } from "@/lib/share-token";
import { defaultReportDisplayName } from "@/lib/nre/report-display-name";
import { adsManagerName } from "@/lib/nre/platform-reporting";
import { CURRENCY_SYMBOLS } from "@/lib/nre/format";
import { buildHistoricalReportData, validateHistoricalReportInput } from "@/lib/nre/historical-report-data";
import { apiErrorResponse } from "@/lib/api-error";
import { requireActiveSubscription } from "@/lib/subscription-guard";
import { resolveDateSelection } from "@/lib/nre/resolve-date-selection";
import { loadPreviousMonthDataRows, loadPreviousMonthDataRowsForCampaigns } from "@/lib/nre/previous-month-data";
import { validateComparisonReportCoverage } from "@/lib/nre/comparison-coverage";
import { detectAdNameColumn, hasAdLevelData } from "@/lib/nre/ad-level";
import { computeCsvDateBounds, computeDailyRangeIso } from "@/lib/nre/date-range";
import type { ReportType } from "@/lib/nre/report-data";
import { mergeObjectiveCache, parseObjectiveCache } from "@/lib/nre/objective-cache";
import {
  campaignMetricOverridesSchema,
  campaignObjectivesSchema,
  comparisonPeriodSchema,
  confirmedCampaignObjectivesSchema,
  historicalMonthCountSchema,
  dateSelectionSchema,
  parseJsonFormField,
  platformSchema,
  reportTitleSchema,
  reportTypeSchema,
  selectedAdSetsSchema,
  selectedCampaignsSchema,
  selectedMetricsSchema,
  uploadSessionIdSchema,
  resolveIncludePreviousMonthComparison,
  resolveShowBudgetPacingOnCover,
} from "@/lib/validators/report-wizard";
import type { Client } from "@/generated/prisma/client";

/** Meta/Google/TikTok path: full campaign/ad-set selection + date-range resolution + Previous Month Data. */
async function buildMetaData(
  client: Client,
  mtdParsed: { colMap: ColumnMap; rows: NreRow[]; headers: string[] },
  formData: FormData | null,
  platform: Platform = "META",
): Promise<{ error: string } | { data: ReportData }> {
  const selectedCampaigns = formData ? parseJsonFormField(formData, "selectedCampaigns", selectedCampaignsSchema) : undefined;
  const selectedAdSets = formData ? parseJsonFormField(formData, "selectedAdSets", selectedAdSetsSchema) : undefined;
  const selectedMetrics = formData ? parseJsonFormField(formData, "selectedMetrics", selectedMetricsSchema) : undefined;
  const campaignObjectives = formData ? parseJsonFormField(formData, "campaignObjectives", campaignObjectivesSchema) : undefined;
  const campaignMetricOverrides = formData ? parseJsonFormField(formData, "campaignMetricOverrides", campaignMetricOverridesSchema) : undefined;
  const dateSelection = formData ? parseJsonFormField(formData, "dateSelection", dateSelectionSchema) : undefined;

  const parsedReportType = formData ? parseJsonFormField(formData, "reportType", reportTypeSchema) : undefined;
  const adNameColumn = detectAdNameColumn(mtdParsed.headers);

  let reportType: ReportType = "WEEKLY";
  if (parsedReportType === "MONTHLY") reportType = "MONTHLY";
  else if (parsedReportType === "DAILY") reportType = "DAILY";
  else if (parsedReportType === "CREATIVE") reportType = "CREATIVE";
  else if (parsedReportType === "QUARTER") reportType = "QUARTER";
  else if (parsedReportType === "YTD") reportType = "YTD";

  if (parsedReportType === "CREATIVE" && !hasAdLevelData(mtdParsed.headers)) {
    return {
      error: `Creative reporting requires an Ad-level CSV with an Ad Name column. Export from ${adsManagerName(platform)} → Ads tab with daily breakdown.`,
    };
  }

  let weeklyRange: { startIso: string; endIso: string } | undefined;
  if (reportType === "DAILY") {
    const daily = computeDailyRangeIso(mtdParsed.rows, new Date(), client.timezone);
    if (!daily) return { error: "Could not determine yesterday's date from the CSV." };
    weeklyRange = daily;
  } else if (reportType !== "CREATIVE" && reportType !== "MONTHLY" && reportType !== "QUARTER" && reportType !== "YTD") {
    const dateResolution = resolveDateSelection(mtdParsed.rows, dateSelection, new Date(), client.timezone);
    if (!dateResolution.ok) {
      return { error: dateResolution.error || "Invalid date selection." };
    }
    weeklyRange = dateResolution.weeklyRange;
  }

  const includePreviousMonthComparison = resolveIncludePreviousMonthComparison(formData);
  const periodRows = includePreviousMonthComparison ? await loadPreviousMonthDataRows(client) : undefined;

  const data = buildReportData({
    accountName: client.accountName,
    currencySymbol: CURRENCY_SYMBOLS[client.currency],
    timezone: client.timezone,
    monthlyBudget: client.monthlyBudget,
    showBudgetPacingOnCover: resolveShowBudgetPacingOnCover(formData, client.showBudgetPacingOnCover),
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
    adNameColumn,
    creativeOnly: reportType === "CREATIVE",
    platform,
  });

  return { data };
}

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
    const summaryData = buildPreviousMonthSummaryReportData({
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

    await dispatchReportGenerationJob(summaryReport.id);
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

    const comparisonData = buildComparisonReportData({
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

    await dispatchReportGenerationJob(comparisonReport.id);
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

    const historicalData = buildHistoricalReportData({
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

    await dispatchReportGenerationJob(historicalReport.id);
    return enqueueResponse(historicalReport.id, shareToken);
  }

  const result = await buildMetaData(client, mtdParsed, formData, platform);
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

  await dispatchReportGenerationJob(report.id);
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
