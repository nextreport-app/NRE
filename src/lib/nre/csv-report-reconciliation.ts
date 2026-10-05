/**
 * Cross-check generated report totals against independent sums from the uploaded CSV.
 * Uses the same date windows as splitMtdDaily / campaign slides (not ad-hoc ranges).
 */

import type { NreRow } from "./columns";
import type { MetricRow } from "./types";
import type { ReportData, ReportType } from "./report-data";
import { filterRowsByCampaigns } from "./campaigns";
import { splitMtdDaily } from "./aggregate";
import { parseCellNum, fmtCurrency, fmtNumber } from "./format";
import { buildCampaignObjectiveMap, groupResultsByCampaignObjective } from "./objective";
import type { ResultCountingMode } from "./meta-csv-export-counting";
import type { DateRangeIso } from "./date-range";

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
}

const SPEND_TOLERANCE = 0.5;

function closeEnough(a: number, b: number, tol: number): boolean {
  return Math.abs(a - b) <= tol;
}

function sumSpend(rows: MetricRow[]): number {
  return rows.reduce((s, r) => s + parseCellNum(r.spend), 0);
}

function sumExportResultsForLabel(
  rows: MetricRow[],
  objectiveMap: Map<string, import("./objective").ResultLabels>,
  label: string,
): number {
  const groups = groupResultsByCampaignObjective(rows, objectiveMap, undefined, "meta-csv-export");
  return groups.find((x) => x.label === label)?.count ?? 0;
}

function sumStandardResultsForLabel(
  rows: MetricRow[],
  objectiveMap: Map<string, import("./objective").ResultLabels>,
  label: string,
): number {
  const groups = groupResultsByCampaignObjective(rows, objectiveMap, undefined, "standard");
  return groups.find((x) => x.label === label)?.count ?? 0;
}

function primaryResultColumn(report: ReportData): { label: string; costLabel: string; value: string; cprValue: string } | null {
  const cols = report.mtdRow.resultColumns.filter((c) => c.label !== "RESULTS");
  if (cols.length === 0) return null;
  const sorted = [...cols].sort((a, b) => parseCellNum(b.value) - parseCellNum(a.value));
  return sorted[0] ?? null;
}

function reportPeriodSpendFromSlides(report: ReportData): number {
  return report.campaignSlides.reduce((s, slide) => s + parseCellNum(slide.metrics.spend), 0);
}

function reportPeriodResultsFromSlides(report: ReportData, resultLabel: string): number {
  return report.campaignSlides
    .filter((slide) => slide.resultLabel === resultLabel)
    .reduce((s, slide) => s + parseCellNum(slide.metrics.results), 0);
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
        : "Summed from your CSV Results column for this date range and campaigns.",
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

  if (checks.some((c) => c.status === "mismatch" && c.metric === resultLabel) && csvStandardResults !== csvExportResults) {
    canAlignRef.value = true;
  }

  return checks;
}

export function reconcileStandardReportWithCsv(input: ReconcileStandardReportInput): CsvVerificationResult {
  const { report, mtdDailyRows, selectedCampaigns, reportType, timezone, currencySymbol } = input;
  if (report.isPaused || report.creativeOnly || reportType === "CREATIVE") {
    return { status: "skipped", checks: [] };
  }

  const filtered = filterRowsByCampaigns(mtdDailyRows, selectedCampaigns ?? null);
  if (filtered.length === 0) {
    return { status: "skipped", checks: [] };
  }

  const now = input.now ?? new Date();
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

  // ── Month-to-date (combined total MTD row) ─────────────────────────────
  const mtdRaw = split.mtdRawRows as MetricRow[];
  if (mtdRaw.length > 0 && report.mtdRow.hasData) {
    const mtdObjectiveMap = buildCampaignObjectiveMap(mtdRaw);
    const csvMtdSpend = sumSpend(mtdRaw);
    const csvMtdResults = sumExportResultsForLabel(mtdRaw, mtdObjectiveMap, resultLabel);
    const csvStdMtdResults = sumStandardResultsForLabel(mtdRaw, mtdObjectiveMap, resultLabel);
    const mtdGroups = groupResultsByCampaignObjective(
      mtdRaw,
      mtdObjectiveMap,
      undefined,
      input.resultCountingMode ?? "standard",
    );
    const mtdObjSpend = mtdGroups.find((g) => g.label === resultLabel)?.totalSpend ?? csvMtdSpend;
    const reportMtdResults = parseCellNum(primaryCol.value);
    const reportMtdCpr = parseCellNum(primaryCol.cprValue);
    const csvMtdCpr = csvMtdResults > 0 ? mtdObjSpend / csvMtdResults : 0;

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
        csvExportResults: csvMtdResults,
      }),
    );
  }

  // ── Report period (campaign slides / weekly window) ────────────────────
  const weeklyRaw = split.weeklyRawRows as MetricRow[];
  if (weeklyRaw.length > 0 && report.campaignSlides.length > 0 && reportType === "WEEKLY") {
    const weeklyObjectiveMap = buildCampaignObjectiveMap(weeklyRaw);
    const csvWeeklySpend = sumSpend(weeklyRaw);
    const csvWeeklyResults = sumExportResultsForLabel(weeklyRaw, weeklyObjectiveMap, resultLabel);
    const csvStdWeeklyResults = sumStandardResultsForLabel(weeklyRaw, weeklyObjectiveMap, resultLabel);
    const weeklyGroups = groupResultsByCampaignObjective(
      weeklyRaw,
      weeklyObjectiveMap,
      undefined,
      input.resultCountingMode ?? "standard",
    );
    const weeklyObjSpend = weeklyGroups.find((g) => g.label === resultLabel)?.totalSpend ?? csvWeeklySpend;
    const reportWeeklySpend = reportPeriodSpendFromSlides(report);
    const reportWeeklyResults = reportPeriodResultsFromSlides(report, resultLabel);
    const slideCpr = report.campaignSlides.find((s) => s.resultLabel === resultLabel)?.metrics.cpr ?? "—";
    const reportWeeklyCpr = parseCellNum(slideCpr);
    const csvWeeklyCpr = csvWeeklyResults > 0 ? weeklyObjSpend / csvWeeklyResults : 0;

    checks.push(
      ...scopedChecks({
        scope: "Report period",
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
        csvExportResults: csvWeeklyResults,
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
    alignedWithCsvExport: input.resultCountingMode === "meta-csv-export",
  };
}
