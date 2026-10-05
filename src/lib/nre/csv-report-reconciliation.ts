/**
 * Cross-check generated report totals against independent sums from the uploaded CSV.
 * Mirrors the same date windows and objective maps as buildReportData / chart slide.
 */

import type { NreRow } from "./columns";
import type { MetricRow } from "./types";
import type { ReportData, ReportType } from "./report-data";
import { filterRowsByCampaigns } from "./campaigns";
import { splitMtdDaily, aggregateRows } from "./aggregate";
import { parseCellNum, fmtCurrency, fmtNumber } from "./format";
import {
  buildCampaignObjectiveMap,
  groupResultsByCampaignObjective,
  normalizeCampaignName,
  type ResultLabels,
} from "./objective";
import type { ResultCountingMode } from "./meta-csv-export-counting";
import {
  capRangeToData,
  computeMtdRangeIso,
  resolveStandardChartRange,
  type DateRangeIso,
} from "./date-range";
import { filterRawRowsToRange } from "./creative-report-data";

export type CsvVerificationStatus = "ok" | "mismatch" | "skipped";

export interface CsvVerificationCheck {
  metric: string;
  scope: string;
  reportDisplay: string;
  csvDisplay: string;
  status: "ok" | "mismatch";
  note?: string;
}

export interface CsvVerificationResult {
  status: CsvVerificationStatus;
  checks: CsvVerificationCheck[];
  primaryResultLabel?: string;
  canAlignWithCsvExport?: boolean;
  alignedWithCsvExport?: boolean;
}

export interface ReconcileStandardReportInput {
  report: ReportData;
  mtdDailyRows: NreRow[];
  selectedCampaigns: string[] | null | undefined;
  weeklyRange?: DateRangeIso;
  reportType: ReportType;
  timezone: string;
  currencySymbol: string;
  now?: Date;
  resultCountingMode?: ResultCountingMode;
  /** Previous Month Data upload rows — required to verify the Period row when included. */
  periodRows?: NreRow[] | null;
  /** Wizard-confirmed objectives — same overrides as buildReportData. */
  campaignObjectives?: Record<string, ResultLabels> | null;
}

const SPEND_TOLERANCE = 0.5;

function closeEnough(a: number, b: number, tol: number): boolean {
  return Math.abs(a - b) <= tol;
}

function sumSpend(rows: MetricRow[]): number {
  return rows.reduce((s, r) => s + parseCellNum(r.spend), 0);
}

function applyCampaignObjectiveOverrides(
  map: Map<string, ResultLabels>,
  campaignObjectives?: Record<string, ResultLabels> | null,
): Map<string, ResultLabels> {
  if (!campaignObjectives) return map;
  const out = new Map(map);
  for (const [name, objective] of Object.entries(campaignObjectives)) {
    out.set(normalizeCampaignName(name), objective);
  }
  return out;
}

function pinnedCampaignKeys(campaignObjectives?: Record<string, ResultLabels> | null): Set<string> {
  return new Set(Object.keys(campaignObjectives ?? {}).map((name) => normalizeCampaignName(name)));
}

/** Same campaign-level map as buildReportData Step 0 (MTD + primary period aggregated rows). */
function buildReportScopeObjectiveMap(
  split: NonNullable<ReturnType<typeof splitMtdDaily>>,
  reportType: ReportType,
  campaignObjectives?: Record<string, ResultLabels> | null,
): Map<string, ResultLabels> {
  const mtdRows = split.mtdRows ?? [];
  const weeklyRows = split.weeklyRows ?? [];
  const primaryRows =
    reportType === "WEEKLY" || reportType === "DAILY" ? weeklyRows : mtdRows;
  const map = buildCampaignObjectiveMap([...mtdRows, ...primaryRows]);
  return applyCampaignObjectiveOverrides(map, campaignObjectives);
}

/** Chart slide map: report map + last-30-window detection (see buildLast30DaysChartSlide). */
function buildChartWindowObjectiveMap(
  baseMap: Map<string, ResultLabels>,
  chartAggRows: MetricRow[],
  pinned: Set<string>,
): Map<string, ResultLabels> {
  const chartMap = new Map(baseMap);
  buildCampaignObjectiveMap(chartAggRows).forEach((labels, name) => {
    if (!pinned.has(name)) chartMap.set(name, labels);
    else if (!chartMap.has(name)) chartMap.set(name, labels);
  });
  return chartMap;
}

function resultsAndSpendForLabel(
  rows: MetricRow[],
  objectiveMap: Map<string, ResultLabels>,
  label: string,
  mode: ResultCountingMode,
): { results: number; attributedSpend: number } {
  const groups = groupResultsByCampaignObjective(rows, objectiveMap, undefined, mode);
  const group = groups.find((g) => g.label === label);
  return {
    results: group?.count ?? 0,
    attributedSpend: group?.totalSpend ?? sumSpend(rows),
  };
}

function sumResultsForLabel(
  rows: MetricRow[],
  objectiveMap: Map<string, ResultLabels>,
  label: string,
  mode: ResultCountingMode,
): number {
  return resultsAndSpendForLabel(rows, objectiveMap, label, mode).results;
}

function primaryResultColumn(report: ReportData): { label: string; costLabel: string; value: string; cprValue: string } | null {
  const cols = report.mtdRow.resultColumns.filter((c) => c.label !== "RESULTS");
  if (cols.length === 0) return null;
  const sorted = [...cols].sort((a, b) => parseCellNum(b.value) - parseCellNum(a.value));
  return sorted[0] ?? null;
}

function periodResultColumn(
  report: ReportData,
  resultLabel: string,
): { label: string; costLabel: string; value: string; cprValue: string } | null {
  const col = report.periodRow.resultColumns.find((c) => c.label === resultLabel);
  if (col) return col;
  const cols = report.periodRow.resultColumns.filter((c) => c.label !== "RESULTS");
  if (cols.length === 0) return null;
  return cols.sort((a, b) => parseCellNum(b.value) - parseCellNum(a.value))[0] ?? null;
}

function reportPeriodSpendFromSlides(report: ReportData): number {
  return report.campaignSlides.reduce((s, slide) => s + parseCellNum(slide.metrics.spend), 0);
}

function reportPeriodResultsFromSlides(report: ReportData, resultLabel: string): number {
  return report.campaignSlides
    .filter((slide) => slide.resultLabel === resultLabel)
    .reduce((s, slide) => s + parseCellNum(slide.metrics.results), 0);
}

/** Results-weighted average CPR across weekly campaign slides (what clients read per slide). */
function blendedCprFromSlides(report: ReportData, resultLabel: string): number {
  let totalResults = 0;
  let weighted = 0;
  report.campaignSlides
    .filter((slide) => slide.resultLabel === resultLabel)
    .forEach((slide) => {
      const results = parseCellNum(slide.metrics.results);
      const cpr = parseCellNum(slide.metrics.cpr);
      if (results > 0 && cpr > 0) {
        totalResults += results;
        weighted += cpr * results;
      }
    });
  return totalResults > 0 ? weighted / totalResults : 0;
}

function scopedChecks(params: {
  scope: string;
  currencySymbol: string;
  reportSpend: number;
  csvSpend: number;
  reportSpendDisplay: string;
  resultLabel: string;
  costLabel: string;
  reportResults: number;
  csvResults: number;
  reportResultsDisplay: string;
  reportCpr: number;
  csvCpr: number;
  reportCprDisplay: string;
  canAlignRef: { value: boolean };
  csvStandardResults: number;
  csvExportResults: number;
  countingMode: ResultCountingMode;
}): CsvVerificationCheck[] {
  const {
    scope,
    currencySymbol,
    reportSpend,
    csvSpend,
    reportSpendDisplay,
    resultLabel,
    costLabel,
    reportResults,
    csvResults,
    reportResultsDisplay,
    reportCpr,
    csvCpr,
    reportCprDisplay,
    canAlignRef,
    csvStandardResults,
    csvExportResults,
    countingMode,
  } = params;

  const checks: CsvVerificationCheck[] = [];

  checks.push({
    metric: "Amount spent",
    scope,
    reportDisplay: reportSpendDisplay,
    csvDisplay: fmtCurrency(csvSpend, currencySymbol),
    status: closeEnough(reportSpend, csvSpend, SPEND_TOLERANCE) ? "ok" : "mismatch",
  });

  checks.push({
    metric: resultLabel,
    scope,
    reportDisplay: reportResultsDisplay,
    csvDisplay: fmtNumber(csvResults),
    status: closeEnough(reportResults, csvResults, 0.01) ? "ok" : "mismatch",
    note:
      closeEnough(reportResults, csvResults, 0.01)
        ? undefined
        : "Summed from your CSV for this date range and selected campaigns (same rules as the report).",
  });

  if (reportResults > 0 || csvResults > 0) {
    checks.push({
      metric: costLabel,
      scope,
      reportDisplay: reportCprDisplay,
      csvDisplay: csvCpr > 0 ? fmtCurrency(csvCpr, currencySymbol) : "—",
      status: closeEnough(reportCpr, csvCpr, SPEND_TOLERANCE) ? "ok" : "mismatch",
    });
  }

  if (
    countingMode === "standard" &&
    checks.some((c) => c.status === "mismatch" && c.metric === resultLabel) &&
    csvStandardResults !== csvExportResults
  ) {
    canAlignRef.value = true;
  }

  return checks;
}

export function reconcileStandardReportWithCsv(input: ReconcileStandardReportInput): CsvVerificationResult {
  const {
    report,
    mtdDailyRows,
    selectedCampaigns,
    reportType,
    timezone,
    currencySymbol,
    campaignObjectives,
  } = input;
  if (report.creativeOnly || reportType === "CREATIVE") {
    return { status: "skipped", checks: [] };
  }

  const filtered = filterRowsByCampaigns(mtdDailyRows, selectedCampaigns ?? null);
  if (filtered.length === 0) {
    return { status: "skipped", checks: [] };
  }

  const now = input.now ?? new Date();
  const countingMode: ResultCountingMode = input.resultCountingMode ?? "standard";
  const split = splitMtdDaily(filtered, now, {
    ...(input.weeklyRange ? { weeklyRange: input.weeklyRange } : {}),
    timezone,
  });
  if (!split) {
    return { status: "skipped", checks: [] };
  }

  const primaryCol = primaryResultColumn(report);
  if (!primaryCol) {
    return { status: "skipped", checks: [] };
  }

  const resultLabel = primaryCol.label;
  const costLabel = primaryCol.costLabel;
  const canAlignRef = { value: false };
  const checks: CsvVerificationCheck[] = [];
  const reportObjectiveMap = buildReportScopeObjectiveMap(split, reportType, campaignObjectives);
  const pinned = pinnedCampaignKeys(campaignObjectives);

  // ── Month-to-date (Combined Total MTD row) ─────────────────────────────
  // buildReportData feeds computeTableRow aggregated mtdRows — not mtdRawRows.
  const mtdRows = (split.mtdRows ?? []) as MetricRow[];
  if (mtdRows.length > 0 && report.mtdRow.hasData) {
    const csvMtdSpend = sumSpend(mtdRows);
    const csvStdMtdResults = sumResultsForLabel(mtdRows, reportObjectiveMap, resultLabel, "standard");
    const csvMtdResults = sumResultsForLabel(mtdRows, reportObjectiveMap, resultLabel, countingMode);
    const csvExportMtdResults = sumResultsForLabel(mtdRows, reportObjectiveMap, resultLabel, "meta-csv-export");
    const mtdGroups = groupResultsByCampaignObjective(mtdRows, reportObjectiveMap, undefined, countingMode);
    const mtdGroup = mtdGroups.find((g) => g.label === resultLabel);
    const reportMtdResults = parseCellNum(primaryCol.value);
    const reportMtdCpr = parseCellNum(primaryCol.cprValue);
    const csvMtdCpr = mtdGroup?.avgCpr ?? 0;

    checks.push(
      ...scopedChecks({
        scope: "Month-to-date",
        currencySymbol,
        reportSpend: parseCellNum(report.mtdRow.spend),
        csvSpend: csvMtdSpend,
        reportSpendDisplay: report.mtdRow.spend,
        resultLabel,
        costLabel,
        reportResults: reportMtdResults,
        csvResults: csvMtdResults,
        reportResultsDisplay: primaryCol.value,
        reportCpr: reportMtdCpr,
        csvCpr: csvMtdCpr,
        reportCprDisplay: primaryCol.cprValue,
        canAlignRef,
        csvStandardResults: csvStdMtdResults,
        csvExportResults: csvExportMtdResults,
        countingMode,
      }),
    );
  }

  // ── Previous month (Combined Total Period row, when included) ───────────
  const filteredPeriodRows = filterRowsByCampaigns(input.periodRows ?? [], selectedCampaigns ?? null);
  if (report.periodRow.hasData && filteredPeriodRows.length > 0) {
    const pmCol = periodResultColumn(report, resultLabel) ?? primaryCol;
    const pmObjectiveMap = applyCampaignObjectiveOverrides(
      buildCampaignObjectiveMap(filteredPeriodRows as MetricRow[]),
      campaignObjectives,
    );
    const pmRaw = filteredPeriodRows as MetricRow[];
    const csvPmSpend = sumSpend(pmRaw);
    const csvStdPmResults = sumResultsForLabel(pmRaw, pmObjectiveMap, pmCol.label, "standard");
    const csvPmResults = sumResultsForLabel(pmRaw, pmObjectiveMap, pmCol.label, countingMode);
    const csvExportPmResults = sumResultsForLabel(pmRaw, pmObjectiveMap, pmCol.label, "meta-csv-export");
    const pmGroups = groupResultsByCampaignObjective(pmRaw, pmObjectiveMap, undefined, countingMode);
    const pmGroup = pmGroups.find((g) => g.label === pmCol.label);
    const reportPmResults = parseCellNum(pmCol.value);
    const reportPmCpr = parseCellNum(pmCol.cprValue);
    const csvPmCpr = pmGroup?.avgCpr ?? 0;

    checks.push(
      ...scopedChecks({
        scope: "Previous month",
        currencySymbol,
        reportSpend: parseCellNum(report.periodRow.spend),
        csvSpend: csvPmSpend,
        reportSpendDisplay: report.periodRow.spend,
        resultLabel: pmCol.label,
        costLabel: pmCol.costLabel,
        reportResults: reportPmResults,
        csvResults: csvPmResults,
        reportResultsDisplay: pmCol.value,
        reportCpr: reportPmCpr,
        csvCpr: csvPmCpr,
        reportCprDisplay: pmCol.cprValue,
        canAlignRef,
        csvStandardResults: csvStdPmResults,
        csvExportResults: csvExportPmResults,
        countingMode,
      }),
    );
  }

  // ── Weekly / report period (campaign summary slides) ───────────────────
  const weeklyRows = (split.weeklyRows ?? []) as MetricRow[];
  if (weeklyRows.length > 0 && report.campaignSlides.length > 0 && (reportType === "WEEKLY" || reportType === "DAILY")) {
    const csvWeeklySpend = sumSpend(weeklyRows);
    const csvStdWeeklyResults = sumResultsForLabel(weeklyRows, reportObjectiveMap, resultLabel, "standard");
    const csvWeeklyResults = sumResultsForLabel(weeklyRows, reportObjectiveMap, resultLabel, countingMode);
    const csvExportWeeklyResults = sumResultsForLabel(weeklyRows, reportObjectiveMap, resultLabel, "meta-csv-export");
    const weeklyGroups = groupResultsByCampaignObjective(weeklyRows, reportObjectiveMap, undefined, countingMode);
    const weeklyGroup = weeklyGroups.find((g) => g.label === resultLabel);
    const reportWeeklySpend = reportPeriodSpendFromSlides(report);
    const reportWeeklyResults = reportPeriodResultsFromSlides(report, resultLabel);
    const reportWeeklyCpr = blendedCprFromSlides(report, resultLabel);
    const slideCpr =
      report.campaignSlides.find((s) => s.resultLabel === resultLabel)?.metrics.cpr ?? "—";
    const csvWeeklyCpr = weeklyGroup?.avgCpr ?? 0;
    const weeklyScope = reportType === "DAILY" ? "Selected day(s)" : "Weekly (last 7 days)";

    checks.push(
      ...scopedChecks({
        scope: weeklyScope,
        currencySymbol,
        reportSpend: reportWeeklySpend,
        csvSpend: csvWeeklySpend,
        reportSpendDisplay: fmtCurrency(reportWeeklySpend, currencySymbol),
        resultLabel,
        costLabel,
        reportResults: reportWeeklyResults,
        csvResults: csvWeeklyResults,
        reportResultsDisplay: fmtNumber(reportWeeklyResults),
        reportCpr: reportWeeklyCpr,
        csvCpr: csvWeeklyCpr,
        reportCprDisplay: slideCpr,
        canAlignRef,
        csvStandardResults: csvStdWeeklyResults,
        csvExportResults: csvExportWeeklyResults,
        countingMode,
      }),
    );
  }

  // ── Last 30 days (visual chart slide) ───────────────────────────────────
  if (report.chart && report.chart.totalAllSpend > 0) {
    const mtdCalendarRange = computeMtdRangeIso(filtered, now, timezone);
    const chartRange = resolveStandardChartRange({
      reportType,
      rows: filtered,
      now,
      timezone,
      primaryRange: input.weeklyRange ?? null,
      calendarRange: mtdCalendarRange,
    });
    const capped = capRangeToData(chartRange, filtered, now, timezone);
    const chartRaw = filterRawRowsToRange(filtered, capped.startIso, capped.endIso) as MetricRow[];
    const chartRows = aggregateRows(chartRaw) as MetricRow[];
    const chartObjectiveMap = buildChartWindowObjectiveMap(reportObjectiveMap, chartRows, pinned);

    const csvChartSpend = sumSpend(chartRows);
    const csvStdChartResults = sumResultsForLabel(chartRows, chartObjectiveMap, resultLabel, "standard");
    const csvChartResults = sumResultsForLabel(chartRows, chartObjectiveMap, resultLabel, countingMode);
    const csvExportChartResults = sumResultsForLabel(chartRows, chartObjectiveMap, resultLabel, "meta-csv-export");
    const chartGroups = groupResultsByCampaignObjective(chartRows, chartObjectiveMap, undefined, countingMode);
    const chartGroup = chartGroups.find((g) => g.label === resultLabel);

    const chartObjectiveEntry = report.chart.snapshot.objectives.find((o) => o.label === resultLabel);
    const reportChartResults = chartObjectiveEntry ? parseCellNum(chartObjectiveEntry.resultsValue) : 0;
    const reportChartCpr = chartObjectiveEntry ? parseCellNum(chartObjectiveEntry.cprValue) : 0;
    const csvChartCpr = chartGroup?.avgCpr ?? 0;

    checks.push(
      ...scopedChecks({
        scope: "Last 30 days (chart)",
        currencySymbol,
        reportSpend: report.chart.totalAllSpend,
        csvSpend: csvChartSpend,
        reportSpendDisplay: fmtCurrency(report.chart.totalAllSpend, currencySymbol),
        resultLabel,
        costLabel,
        reportResults: reportChartResults,
        csvResults: csvChartResults,
        reportResultsDisplay: chartObjectiveEntry?.resultsValue ?? fmtNumber(reportChartResults),
        reportCpr: reportChartCpr,
        csvCpr: csvChartCpr,
        reportCprDisplay: chartObjectiveEntry?.cprValue ?? "—",
        canAlignRef,
        csvStandardResults: csvStdChartResults,
        csvExportResults: csvExportChartResults,
        countingMode,
      }),
    );
  }

  if (checks.length === 0) {
    return { status: "skipped", checks: [] };
  }

  const hasMismatch = checks.some((c) => c.status === "mismatch");
  return {
    status: hasMismatch ? "mismatch" : "ok",
    checks,
    primaryResultLabel: resultLabel,
    canAlignWithCsvExport: hasMismatch && canAlignRef.value,
    alignedWithCsvExport: countingMode === "meta-csv-export",
  };
}
