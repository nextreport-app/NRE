/**
 * Cross-check generated report totals against independent sums from the uploaded CSV.
 */

import type { NreRow } from "./columns";
import type { MetricRow } from "./types";
import type { ReportData, ReportType } from "./report-data";
import { filterRowsByCampaigns } from "./campaigns";
import {
  computeMtdRangeIso,
  computeQuarterRangeIso,
  computeYtdRangeIso,
  filterNreRowsByDateRange,
  type DateRangeIso,
} from "./date-range";
import { splitMtdDaily } from "./aggregate";
import { parseCellNum, fmtNumber } from "./format";
import { buildCampaignObjectiveMap, groupResultsByCampaignObjective } from "./objective";
import type { ResultCountingMode } from "./meta-csv-export-counting";
import { aggregateReachAcrossCampaigns } from "./reach-aggregation";
import { impliedClicks } from "./report-data";

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
  /** Primary result objective label (highest-spend column on combined total). */
  primaryResultLabel?: string;
  /** Standard engine counts differ from export-style sums — align mode may fix. */
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
  now?: Date;
  resultCountingMode?: ResultCountingMode;
}

const SPEND_TOLERANCE = 0.05;
const RATE_TOLERANCE = 0.06;

function closeEnough(a: number, b: number, tol: number): boolean {
  return Math.abs(a - b) <= tol;
}

function sumSpendImpressionsClicks(rows: MetricRow[]): { spend: number; impressions: number; clicks: number } {
  let spend = 0;
  let impressions = 0;
  let clicks = 0;
  rows.forEach((row) => {
    const s = parseCellNum(row.spend);
    const impr = parseCellNum(row.impressions);
    spend += s;
    impressions += impr;
    clicks += impliedClicks(row, s, impr);
  });
  return { spend, impressions, clicks };
}

function combinedTotalRange(
  input: ReconcileStandardReportInput,
  filteredRows: NreRow[],
): DateRangeIso {
  const now = input.now ?? new Date();
  const { reportType, weeklyRange, timezone } = input;
  const isDaily = reportType === "DAILY";
  const isQuarter = reportType === "QUARTER";
  const isYtd = reportType === "YTD";
  const mtdCalendarRange = isQuarter
    ? computeQuarterRangeIso(now, timezone)
    : isYtd
      ? computeYtdRangeIso(now, timezone)
      : computeMtdRangeIso(filteredRows, now, timezone);

  if (isDaily && weeklyRange) return weeklyRange;
  if (reportType === "WEEKLY" && weeklyRange) return mtdCalendarRange;
  return mtdCalendarRange;
}

function sumExportResultsForLabel(rows: MetricRow[], objectiveMap: Map<string, import("./objective").ResultLabels>, label: string): number {
  const groups = groupResultsByCampaignObjective(rows, objectiveMap, undefined, "meta-csv-export");
  const g = groups.find((x) => x.label === label);
  return g?.count ?? 0;
}

function sumStandardResultsForLabel(rows: MetricRow[], objectiveMap: Map<string, import("./objective").ResultLabels>, label: string): number {
  const groups = groupResultsByCampaignObjective(rows, objectiveMap, undefined, "standard");
  const g = groups.find((x) => x.label === label);
  return g?.count ?? 0;
}

export function reconcileStandardReportWithCsv(input: ReconcileStandardReportInput): CsvVerificationResult {
  const { report, mtdDailyRows, selectedCampaigns, reportType, timezone } = input;
  if (report.isPaused || report.creativeOnly) {
    return { status: "skipped", checks: [] };
  }

  const filtered = filterRowsByCampaigns(mtdDailyRows, selectedCampaigns ?? null);
  if (filtered.length === 0) {
    return { status: "skipped", checks: [] };
  }

  const range = combinedTotalRange(input, filtered);
  const rawInRange = filterNreRowsByDateRange(filtered, range) as MetricRow[];
  if (rawInRange.length === 0) {
    return { status: "skipped", checks: [] };
  }

  const objectiveMap = buildCampaignObjectiveMap(rawInRange);
  const { spend, impressions, clicks } = sumSpendImpressionsClicks(rawInRange);
  const reach = aggregateReachAcrossCampaigns(rawInRange);
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const cpc = clicks > 0 ? spend / clicks : 0;

  const checks: CsvVerificationCheck[] = [];
  const scopeLabel =
    reportType === "DAILY"
      ? "Selected day (combined total)"
      : reportType === "WEEKLY"
        ? "Month-to-date row"
        : "Combined total";

  const reportSpend = parseCellNum(report.mtdRow.spend);
  checks.push({
    metric: "Spend",
    scope: scopeLabel,
    reportDisplay: report.mtdRow.spend,
    csvDisplay: fmtNumber(spend),
    status: closeEnough(reportSpend, spend, SPEND_TOLERANCE) ? "ok" : "mismatch",
  });

  const reportImpr = parseCellNum(report.mtdRow.impressions);
  checks.push({
    metric: "Impressions",
    scope: scopeLabel,
    reportDisplay: report.mtdRow.impressions,
    csvDisplay: fmtNumber(impressions),
    status: closeEnough(reportImpr, impressions, 0.5) ? "ok" : "mismatch",
  });

  const reportCtr = parseCellNum(report.mtdRow.ctr);
  checks.push({
    metric: "CTR",
    scope: scopeLabel,
    reportDisplay: report.mtdRow.ctr,
    csvDisplay: `${ctr.toFixed(2)}%`,
    status: closeEnough(reportCtr, ctr, RATE_TOLERANCE) ? "ok" : "mismatch",
  });

  const reportCpc = parseCellNum(report.mtdRow.cpc);
  checks.push({
    metric: "CPC",
    scope: scopeLabel,
    reportDisplay: report.mtdRow.cpc,
    csvDisplay: cpc > 0 ? `$${cpc.toFixed(2)}` : "—",
    status: cpc <= 0 && report.mtdRow.cpc === "—" ? "ok" : closeEnough(reportCpc, cpc, SPEND_TOLERANCE) ? "ok" : "mismatch",
  });

  const reportReach = parseCellNum(report.mtdRow.reach);
  checks.push({
    metric: "Reach",
    scope: scopeLabel,
    reportDisplay: report.mtdRow.reach,
    csvDisplay: fmtNumber(reach),
    status: closeEnough(reportReach, reach, 0.5) ? "ok" : "mismatch",
  });

  let canAlign = false;
  let primaryResultLabel: string | undefined;

  for (const col of report.mtdRow.resultColumns) {
    if (col.label === "RESULTS") continue;
    const reportCount = parseCellNum(col.value);
    const csvExportCount = sumExportResultsForLabel(rawInRange, objectiveMap, col.label);
    const csvStandardCount = sumStandardResultsForLabel(rawInRange, objectiveMap, col.label);

    if (!primaryResultLabel && (reportCount > 0 || csvExportCount > 0)) {
      primaryResultLabel = col.label;
    }

    const status =
      reportCount === csvExportCount || closeEnough(reportCount, csvExportCount, 0.01)
        ? "ok"
        : "mismatch";

    if (status === "mismatch" && csvStandardCount !== csvExportCount) {
      canAlign = true;
    }

    checks.push({
      metric: col.label,
      scope: scopeLabel,
      reportDisplay: col.value,
      csvDisplay: fmtNumber(csvExportCount),
      status,
      note:
        status === "mismatch"
          ? "Summed from your CSV Results column (and Result type) for the same dates and campaigns."
          : undefined,
    });

    const reportCpr = parseCellNum(col.cprValue);
    if (reportCount > 0 && reportCpr > 0) {
      const csvCpr = spend > 0 && csvExportCount > 0 ? spend / csvExportCount : 0;
      const objectiveGroups = groupResultsByCampaignObjective(rawInRange, objectiveMap, undefined, input.resultCountingMode ?? "standard");
      const objSpend = objectiveGroups.find((g) => g.label === col.label)?.totalSpend ?? spend;
      const csvCprScoped = objSpend > 0 && csvExportCount > 0 ? objSpend / csvExportCount : csvCpr;
      checks.push({
        metric: col.costLabel,
        scope: scopeLabel,
        reportDisplay: col.cprValue,
        csvDisplay: csvCprScoped > 0 ? `$${csvCprScoped.toFixed(2)}` : "—",
        status: closeEnough(reportCpr, csvCprScoped, SPEND_TOLERANCE) ? "ok" : "mismatch",
      });
    }
  }

  if (report.chart && reportType === "WEEKLY") {
    const chartSpend = report.chart.totalAllSpend;
    const split = splitMtdDaily(filtered, input.now ?? new Date(), {
      ...(input.weeklyRange ? { weeklyRange: input.weeklyRange } : {}),
      timezone,
    });
    const weeklyRaw = split?.weeklyRawRows ?? [];
    const weeklySpend = weeklyRaw.reduce((s, r) => s + parseCellNum(r.spend), 0);
    checks.push({
      metric: "Spend",
      scope: "Report period (chart)",
      reportDisplay: fmtNumber(chartSpend),
      csvDisplay: fmtNumber(weeklySpend),
      status: closeEnough(chartSpend, weeklySpend, SPEND_TOLERANCE) ? "ok" : "mismatch",
    });
  }

  const hasMismatch = checks.some((c) => c.status === "mismatch");
  return {
    status: hasMismatch ? "mismatch" : "ok",
    checks,
    primaryResultLabel,
    canAlignWithCsvExport: hasMismatch && canAlign,
    alignedWithCsvExport: input.resultCountingMode === "meta-csv-export",
  };
}
