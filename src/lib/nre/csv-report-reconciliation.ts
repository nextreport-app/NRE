/**
 * Cross-check generated report totals against independent sums from the uploaded CSV.
 *
 * Weekly spend compares campaign-slide totals to a fresh sum of raw daily rows in
 * the labeled report window (not splitMtdDaily's cached slice). If the CSV is
 * missing calendar days inside that window, verification fails even when report
 * and partial CSV agree — otherwise under-counts vs Ads Manager show a green check.
 */

import type { NreRow } from "./columns";
import type { MetricRow } from "./types";
import type { ComparisonReportData, Platform, ReportData, ReportType, TableRowData } from "./report-data";
import type { HistoricalReportData } from "./historical-report-data";
import type { DayBreakdownReportData } from "./day-breakdown-report-data";
import { adSetKey } from "./ad-sets";
import { filterRowsByCampaigns } from "./campaigns";
import { mergeComparisonPeriodRows } from "./comparison-coverage";
import { splitMtdDaily, aggregateRows, type AggRow } from "./aggregate";
import { filterNreRowsByDateRange } from "./date-range";
import { parseCellNum, fmtCurrency, fmtNumber, fmtPercent, fmtCurrency2dp } from "./format";
import { blendedCostPerLinkClickFromRows, combinedCtrCpcFromRows, sumLinkClicksFromRows } from "./ctr-cpc";
import { getDateRangeAbbrLabel } from "./dates";
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
  computeWeeklyRangeOptions,
  resolveStandardChartRange,
  type DateRangeIso,
} from "./date-range";
import { validateWeeklyCsvDayRowsPresent } from "./weekly-csv-coverage";
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
  /** Human-readable windows that were checked (for green-state copy). */
  scopesVerified?: string[];
  /** When status is skipped — shown in the wizard instead of hiding the row. */
  skipReason?: string;
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
  platform?: Platform;
}

const NON_META_SKIP_REASON =
  "CSV cross-check is enabled for Meta first. Google and TikTok use the same engine but are not auto-verified yet.";

/** Minor spend drift from rounding / display — not flagged (user: ~$1–2 is OK). */
const SPEND_AMOUNT_TOLERANCE = 2;
/** Cost per result may differ slightly when spend is in the band above. */
const CPR_TOLERANCE = 1;
/** Blended CTR (all) — percentage points. */
const CTR_TOLERANCE = 0.2;
/** Blended CPC (all) — currency units (display rounding). */
const CPC_ALL_TOLERANCE = 0.06;

function closeEnough(a: number, b: number, tol: number): boolean {
  return Math.abs(a - b) <= tol;
}

/** Results must match the CSV exactly (whole numbers — no 25 vs 26). */
function resultsMatch(reportResults: number, csvResults: number): boolean {
  return Math.round(reportResults) === Math.round(csvResults);
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

/**
 * Independent CSV reference — sum daily export rows before ad-set rollup.
 * Rollup can inflate WEBSITE LEADS (Results || Website leads per day); Ads
 * Manager period totals match day-level Results rules instead.
 */
function sumResultsForLabelFromRawDailyRows(
  rawRows: NreRow[],
  objectiveMap: Map<string, ResultLabels>,
  label: string,
  mode: ResultCountingMode,
): number {
  if (rawRows.length === 0) return 0;
  return sumResultsForLabel(rawRows as MetricRow[], objectiveMap, label, mode);
}

function attributedSpendForLabelFromRawDailyRows(
  rawRows: NreRow[],
  objectiveMap: Map<string, ResultLabels>,
  label: string,
  mode: ResultCountingMode,
): number {
  if (rawRows.length === 0) return 0;
  return resultsAndSpendForLabel(rawRows as MetricRow[], objectiveMap, label, mode).attributedSpend;
}

function primaryResultColumn(report: ReportData): { label: string; costLabel: string; value: string; cprValue: string } | null {
  const cols = report.mtdRow.resultColumns.filter((c) => c.label !== "RESULTS");
  if (cols.length === 0) return null;
  const sorted = [...cols].sort((a, b) => parseCellNum(b.value) - parseCellNum(a.value));
  return sorted[0] ?? null;
}

function primaryResultColumnFromTableRow(row: TableRowData): { label: string; costLabel: string; value: string; cprValue: string } | null {
  const cols = row.resultColumns.filter((c) => c.label !== "RESULTS");
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

function isNonAdditiveReachStyleResult(resultLabel: string): boolean {
  const result = resultLabel.toUpperCase();
  return result === "REACH" || result.includes("IMPRESSION") || result.includes("RECALL");
}

/** Primary result count — skip Reach: daily CSV sums are not period deduplicated (report uses campaign-level reach). */
function shouldVerifyPrimaryResults(resultLabel: string): boolean {
  return !isNonAdditiveReachStyleResult(resultLabel);
}

/** CPR in CSV verify only when report and CSV use the same cost-per-result math (skip derived rates like cost per 1K reach). */
function shouldVerifyCostPerResult(costLabel: string, resultLabel: string): boolean {
  const cost = costLabel.toUpperCase();
  if (cost.includes("1K REACH") || cost.includes("CPM") || cost.includes("FREQUENCY")) return false;
  if (isNonAdditiveReachStyleResult(resultLabel)) return false;
  return true;
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
  /** When false, spend/results/CPR cannot match Ads Manager — flag even if report matches partial CSV sum. */
  calendarComplete?: boolean;
  calendarIncompleteNote?: string;
  /** When CPR uses attributed spend (e.g. chart / multi-objective), pass spend basis for spend÷results. */
  cprReportSpend?: number;
  cprCsvSpend?: number;
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
    calendarComplete = true,
    calendarIncompleteNote,
    cprReportSpend,
    cprCsvSpend,
  } = params;

  const checks: CsvVerificationCheck[] = [];
  const spendMatches = closeEnough(reportSpend, csvSpend, SPEND_AMOUNT_TOLERANCE);
  const resultsOk = resultsMatch(reportResults, csvResults);
  const cprMatches = closeEnough(reportCpr, csvCpr, CPR_TOLERANCE);

  checks.push({
    metric: "Amount spent",
    scope,
    reportDisplay: reportSpendDisplay,
    csvDisplay: fmtCurrency(csvSpend, currencySymbol),
    status: calendarComplete && spendMatches ? "ok" : "mismatch",
    note: !calendarComplete
      ? calendarIncompleteNote ??
        "CSV is missing days in this report week — report totals may not match Ads Manager."
      : spendMatches
        ? undefined
        : `Report shows ${reportSpendDisplay}; CSV sums to ${fmtCurrency(csvSpend, currencySymbol)} for this window.`,
  });

  if (shouldVerifyPrimaryResults(resultLabel)) {
    checks.push({
      metric: resultLabel,
      scope,
      reportDisplay: reportResultsDisplay,
      csvDisplay: fmtNumber(csvResults),
      status: calendarComplete && resultsOk ? "ok" : "mismatch",
      note: !calendarComplete
        ? calendarIncompleteNote
        : resultsOk
          ? undefined
          : `Report shows ${Math.round(reportResults)}; CSV sums to ${Math.round(csvResults)} for this window.`,
    });
  }

  if (
    shouldVerifyCostPerResult(costLabel, resultLabel) &&
    (reportResults > 0 || csvResults > 0)
  ) {
    const spendForReportCpr = cprReportSpend ?? reportSpend;
    const spendForCsvCpr = cprCsvSpend ?? csvSpend;
    const impliedReportCpr =
      reportResults > 0 && spendForReportCpr > 0 ? spendForReportCpr / reportResults : 0;
    const impliedCsvCpr = csvResults > 0 && spendForCsvCpr > 0 ? spendForCsvCpr / csvResults : 0;
    const cprTotalsMatch = closeEnough(impliedReportCpr, impliedCsvCpr, CPR_TOLERANCE);
    const reportCprConsistent =
      impliedReportCpr <= 0 || closeEnough(reportCpr, impliedReportCpr, CPR_TOLERANCE);
    const csvAttributedConsistent =
      impliedCsvCpr <= 0 || closeEnough(csvCpr, impliedCsvCpr, CPR_TOLERANCE) || closeEnough(csvCpr, impliedReportCpr, CPR_TOLERANCE);
    const cprOk =
      calendarComplete &&
      cprMatches &&
      cprTotalsMatch &&
      reportCprConsistent &&
      (csvAttributedConsistent || cprTotalsMatch);

    checks.push({
      metric: costLabel,
      scope,
      reportDisplay: reportCprDisplay,
      csvDisplay: csvCpr > 0 ? fmtCurrency(csvCpr, currencySymbol) : "—",
      status: cprOk ? "ok" : "mismatch",
      note: !calendarComplete
        ? calendarIncompleteNote
        : !cprTotalsMatch
          ? `Cost per result should be spend ÷ results (${fmtCurrency(impliedReportCpr, currencySymbol)} vs CSV ${fmtCurrency(impliedCsvCpr, currencySymbol)}).`
          : !reportCprConsistent
            ? `Report ${costLabel} does not match spend ÷ results for this window.`
            : undefined,
    });
  }

  if (
    shouldVerifyPrimaryResults(resultLabel) &&
    countingMode === "standard" &&
    checks.some((c) => c.status === "mismatch" && c.metric === resultLabel) &&
    csvStandardResults !== csvExportResults
  ) {
    canAlignRef.value = true;
  }

  return checks;
}

function appendCtrCpcChecks(params: {
  checks: CsvVerificationCheck[];
  scope: string;
  rawRows: MetricRow[];
  reportCtrDisplay: string;
  reportCpcDisplay: string;
  currencySymbol: string;
  calendarComplete?: boolean;
  campaignSuffix?: string;
}): void {
  const {
    checks,
    scope,
    rawRows,
    reportCtrDisplay,
    reportCpcDisplay,
    currencySymbol,
    calendarComplete = true,
    campaignSuffix,
  } = params;
  if (rawRows.length === 0) return;

  const { ctr: csvCtr, cpc: csvCpc } = combinedCtrCpcFromRows(rawRows);
  const reportCtr = parseCellNum(reportCtrDisplay);
  const reportCpc = parseCellNum(reportCpcDisplay);
  const suffix = campaignSuffix ? ` (${campaignSuffix})` : "";

  if (csvCtr > 0 && reportCtr > 0) {
    checks.push({
      metric: `CTR (all)${suffix}`,
      scope,
      reportDisplay: reportCtrDisplay,
      csvDisplay: fmtPercent(csvCtr),
      status: calendarComplete && closeEnough(reportCtr, csvCtr, CTR_TOLERANCE) ? "ok" : "mismatch",
      note:
        !calendarComplete
          ? undefined
          : closeEnough(reportCtr, csvCtr, CTR_TOLERANCE)
            ? undefined
            : "CTR (all) is blended from your CSV (total all-clicks ÷ impressions), not a simple average of daily rows.",
    });
  }

  if (csvCpc > 0 && reportCpc > 0) {
    checks.push({
      metric: `CPC (all)${suffix}`,
      scope,
      reportDisplay: reportCpcDisplay,
      csvDisplay: fmtCurrency2dp(csvCpc, currencySymbol),
      status: calendarComplete && closeEnough(reportCpc, csvCpc, CPC_ALL_TOLERANCE) ? "ok" : "mismatch",
      note:
        !calendarComplete
          ? undefined
          : closeEnough(reportCpc, csvCpc, CPC_ALL_TOLERANCE)
            ? undefined
            : "CPC (all) is total spend ÷ all-clicks for this window — not cost per link click.",
    });
  }
}

function parseDisplayNumber(display: string | undefined): number {
  if (!display || display === "—") return 0;
  return parseCellNum(display.replace(/[^0-9.\-]/g, ""));
}

/** Link clicks + cost per link click — must match blended CSV totals, not one day's cells. */
function appendLinkClickCpcChecks(params: {
  checks: CsvVerificationCheck[];
  scope: string;
  rawRows: MetricRow[];
  reportLinkClicksDisplay?: string;
  reportCplcDisplay?: string;
  currencySymbol: string;
  calendarComplete?: boolean;
  campaignSuffix?: string;
}): void {
  const {
    checks,
    scope,
    rawRows,
    reportLinkClicksDisplay,
    reportCplcDisplay,
    currencySymbol,
    calendarComplete = true,
    campaignSuffix,
  } = params;
  if (rawRows.length === 0) return;
  const suffix = campaignSuffix ? ` (${campaignSuffix})` : "";

  const csvLinkClicks = sumLinkClicksFromRows(rawRows);
  const reportLinkClicks = parseDisplayNumber(reportLinkClicksDisplay);
  if (csvLinkClicks > 0 && reportLinkClicks > 0) {
    checks.push({
      metric: `Link clicks${suffix}`,
      scope,
      reportDisplay: reportLinkClicksDisplay ?? "—",
      csvDisplay: fmtNumber(csvLinkClicks),
      status: calendarComplete && reportLinkClicks === csvLinkClicks ? "ok" : "mismatch",
      note:
        reportLinkClicks === csvLinkClicks
          ? undefined
          : "Link clicks must be the sum of the CSV Link clicks column for this window — not Clicks (all).",
    });
  }

  const csvCplc = blendedCostPerLinkClickFromRows(rawRows);
  const reportCplc = parseDisplayNumber(reportCplcDisplay);
  if (csvCplc > 0 && reportCplc > 0) {
    checks.push({
      metric: `Cost per link click${suffix}`,
      scope,
      reportDisplay: reportCplcDisplay ?? "—",
      csvDisplay: fmtCurrency2dp(csvCplc, currencySymbol),
      status: calendarComplete && closeEnough(reportCplc, csvCplc, CPC_ALL_TOLERANCE) ? "ok" : "mismatch",
      note: closeEnough(reportCplc, csvCplc, CPC_ALL_TOLERANCE)
        ? undefined
        : "Cost per link click = total spend ÷ total link clicks for the window — not an average of daily CPC cells.",
    });
  }
}

function linkClickMetricsFromSlide(slide: {
  dynamicMetrics?: ({ key: string; value: string } | null)[];
  additionalMetricsSlide?: ({ key: string; value: string } | null)[];
}): {
  linkClicks?: string;
  cplc?: string;
} {
  const metrics = [...(slide.dynamicMetrics ?? []), ...(slide.additionalMetricsSlide ?? [])];
  const linkClicks = metrics.find((m) => m?.key === "link_clicks")?.value;
  const cplc = metrics.find((m) => m?.key === "cpc_link_click")?.value;
  return { linkClicks, cplc };
}

function adSetSlideScope(parentScope: string, adSetName: string): string {
  const short = adSetName.length > 36 ? `${adSetName.slice(0, 33)}…` : adSetName;
  return `${parentScope} · Ad set: ${short}`;
}

function filterWeeklyRawForAdSet(rawRows: NreRow[], campaignName: string, adSetName: string): NreRow[] {
  const want = adSetKey(campaignName.trim(), adSetName.trim());
  return rawRows.filter((r) => adSetKey(String(r.campaign_name ?? "").trim(), String(r.ad_set_name ?? "").trim()) === want);
}

/** Per ad-set slide — same metrics as campaign slide checks for the report week. */
function appendAdSetSlideChecks(params: {
  checks: CsvVerificationCheck[];
  parentScope: string;
  currencySymbol: string;
  adSlide: ReportData["adSetSlides"][number];
  rawRows: NreRow[];
  objectiveMap: Map<string, ResultLabels>;
  countingMode: ResultCountingMode;
  calendarComplete?: boolean;
  calendarIncompleteNote?: string;
}): void {
  const {
    checks,
    parentScope,
    currencySymbol,
    adSlide,
    rawRows,
    objectiveMap,
    countingMode,
    calendarComplete = true,
    calendarIncompleteNote,
  } = params;
  if (rawRows.length === 0) return;

  const scope = adSetSlideScope(parentScope, adSlide.adSetName);
  const csvSpend = sumSpend(rawRows);
  const reportSpend = parseCellNum(adSlide.metrics.spend);
  const spendMatches = closeEnough(reportSpend, csvSpend, SPEND_AMOUNT_TOLERANCE);

  checks.push({
    metric: "Amount spent",
    scope,
    reportDisplay: adSlide.metrics.spend,
    csvDisplay: fmtCurrency(csvSpend, currencySymbol),
    status: calendarComplete && spendMatches ? "ok" : "mismatch",
    note: !calendarComplete
      ? calendarIncompleteNote
      : spendMatches
        ? undefined
        : `Ad-set slide spend must match the CSV sum for this ad set in the report week.`,
  });

  if (shouldVerifyPrimaryResults(adSlide.resultLabel)) {
    const csvResults = sumResultsForLabelFromRawDailyRows(rawRows, objectiveMap, adSlide.resultLabel, countingMode);
    const reportResults = parseCellNum(adSlide.metrics.results);
    const resultsOk = resultsMatch(reportResults, csvResults);
    checks.push({
      metric: adSlide.resultLabel,
      scope,
      reportDisplay: adSlide.metrics.results,
      csvDisplay: fmtNumber(csvResults),
      status: calendarComplete && resultsOk ? "ok" : "mismatch",
      note: !calendarComplete
        ? calendarIncompleteNote
        : resultsOk
          ? undefined
          : `Ad-set slide results must match a fresh CSV sum for this ad set (export counting rules).`,
    });

    if (shouldVerifyCostPerResult(adSlide.costLabel, adSlide.resultLabel) && (reportResults > 0 || csvResults > 0)) {
      const attributedSpend = attributedSpendForLabelFromRawDailyRows(
        rawRows,
        objectiveMap,
        adSlide.resultLabel,
        countingMode,
      );
      const reportCpr = parseCellNum(adSlide.metrics.cpr);
      const csvCpr = csvResults > 0 && attributedSpend > 0 ? attributedSpend / csvResults : 0;
      const impliedReportCpr = reportResults > 0 && attributedSpend > 0 ? attributedSpend / reportResults : 0;
      const cprOk =
        calendarComplete &&
        closeEnough(reportCpr, csvCpr, CPR_TOLERANCE) &&
        (impliedReportCpr <= 0 || closeEnough(reportCpr, impliedReportCpr, CPR_TOLERANCE));

      checks.push({
        metric: adSlide.costLabel,
        scope,
        reportDisplay: adSlide.metrics.cpr,
        csvDisplay: csvCpr > 0 ? fmtCurrency(csvCpr, currencySymbol) : "—",
        status: cprOk ? "ok" : "mismatch",
        note: cprOk ? undefined : `Ad-set ${adSlide.costLabel} must match spend ÷ results for this window.`,
      });
    }
  }

  appendCtrCpcChecks({
    checks,
    scope,
    rawRows,
    reportCtrDisplay: adSlide.metrics.ctr,
    reportCpcDisplay: adSlide.metrics.cpc,
    currencySymbol,
    calendarComplete,
  });

  const { linkClicks, cplc } = linkClickMetricsFromSlide(adSlide);
  appendLinkClickCpcChecks({
    checks,
    scope,
    rawRows,
    reportLinkClicksDisplay: linkClicks,
    reportCplcDisplay: cplc,
    currencySymbol,
    calendarComplete,
  });
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
    platform,
  } = input;
  if (platform && platform !== "META") {
    return { status: "skipped", checks: [], skipReason: NON_META_SKIP_REASON };
  }
  if (report.creativeOnly || reportType === "CREATIVE") {
    return { status: "skipped", checks: [] };
  }

  const filtered = filterRowsByCampaigns(mtdDailyRows, selectedCampaigns ?? null);
  if (filtered.length === 0) {
    return { status: "skipped", checks: [] };
  }

  const now = input.now ?? new Date();
  const countingMode: ResultCountingMode = input.resultCountingMode ?? "standard";
  const resolvedWeeklyForSplit =
    input.weeklyRange ??
    (reportType === "WEEKLY" ? computeWeeklyRangeOptions(filtered, now, timezone)?.last7 : undefined);
  const effectiveWeeklyForSplit =
    resolvedWeeklyForSplit && reportType === "WEEKLY"
      ? capRangeToData(resolvedWeeklyForSplit, filtered, now, timezone)
      : resolvedWeeklyForSplit;
  const split = splitMtdDaily(filtered, now, {
    ...(effectiveWeeklyForSplit ? { weeklyRange: effectiveWeeklyForSplit } : {}),
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
  const mtdRawRows = split.mtdRawRows ?? [];
  const mtdRows = (split.mtdRows ?? []) as MetricRow[];
  if (mtdRawRows.length > 0 && report.mtdRow.hasData) {
    const csvMtdSpend = sumSpend(mtdRawRows as MetricRow[]);
    const csvStdMtdResults = sumResultsForLabelFromRawDailyRows(mtdRawRows, reportObjectiveMap, resultLabel, "standard");
    const csvMtdResults = sumResultsForLabelFromRawDailyRows(mtdRawRows, reportObjectiveMap, resultLabel, countingMode);
    const csvExportMtdResults = sumResultsForLabelFromRawDailyRows(
      mtdRawRows,
      reportObjectiveMap,
      resultLabel,
      "meta-csv-export",
    );
    const mtdAttributedSpend = attributedSpendForLabelFromRawDailyRows(
      mtdRawRows,
      reportObjectiveMap,
      resultLabel,
      countingMode,
    );
    const csvMtdCpr =
      csvMtdResults > 0 && mtdAttributedSpend > 0 ? mtdAttributedSpend / csvMtdResults : 0;
    const reportMtdResults = parseCellNum(primaryCol.value);
    const reportMtdSpend = parseCellNum(report.mtdRow.spend);
    const mtdCprFromTable = parseCellNum(primaryCol.cprValue);
    const reportMtdCpr =
      mtdCprFromTable > 0
        ? mtdCprFromTable
        : reportMtdResults > 0 && reportMtdSpend > 0
          ? reportMtdSpend / reportMtdResults
          : 0;

    const mtdScope = report.mtdRow.monthLabel
      ? `Month-to-date (${report.mtdRow.monthLabel})`
      : "Month-to-date";
    checks.push(
      ...scopedChecks({
        scope: mtdScope,
        currencySymbol,
        reportSpend: reportMtdSpend,
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
        cprReportSpend: mtdAttributedSpend,
        cprCsvSpend: mtdAttributedSpend,
        canAlignRef,
        csvStandardResults: csvStdMtdResults,
        csvExportResults: csvExportMtdResults,
        countingMode,
      }),
    );
    appendCtrCpcChecks({
      checks,
      scope: mtdScope,
      rawRows: mtdRawRows as MetricRow[],
      reportCtrDisplay: report.mtdRow.ctr,
      reportCpcDisplay: report.mtdRow.cpc,
      currencySymbol,
    });
  }

  // ── Previous month (Combined Total Period row, when included) ───────────
  const filteredPeriodRows = filterRowsByCampaigns(input.periodRows ?? [], selectedCampaigns ?? null);
  if (report.periodRow.hasData && filteredPeriodRows.length > 0) {
    const pmCol = periodResultColumn(report, resultLabel) ?? primaryCol;
    const pmObjectiveMap = applyCampaignObjectiveOverrides(
      buildCampaignObjectiveMap(filteredPeriodRows as MetricRow[]),
      campaignObjectives,
    );
    const pmRaw = filteredPeriodRows;
    const csvPmSpend = sumSpend(pmRaw as MetricRow[]);
    const csvStdPmResults = sumResultsForLabelFromRawDailyRows(pmRaw, pmObjectiveMap, pmCol.label, "standard");
    const csvPmResults = sumResultsForLabelFromRawDailyRows(pmRaw, pmObjectiveMap, pmCol.label, countingMode);
    const csvExportPmResults = sumResultsForLabelFromRawDailyRows(
      pmRaw,
      pmObjectiveMap,
      pmCol.label,
      "meta-csv-export",
    );
    const pmAttributedSpend = attributedSpendForLabelFromRawDailyRows(
      pmRaw,
      pmObjectiveMap,
      pmCol.label,
      countingMode,
    );
    const reportPmResults = parseCellNum(pmCol.value);
    const reportPmCpr = parseCellNum(pmCol.cprValue);
    const csvPmCpr = csvPmResults > 0 && pmAttributedSpend > 0 ? pmAttributedSpend / csvPmResults : 0;

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
  const displayWeeklyRange =
    reportType === "WEEKLY" ? effectiveWeeklyForSplit : input.weeklyRange;

  let weeklyCalendarComplete = true;
  let weeklyCalendarNote: string | undefined;
  if (displayWeeklyRange && reportType === "WEEKLY") {
    const coverage = validateWeeklyCsvDayRowsPresent(filtered, displayWeeklyRange, selectedCampaigns);
    weeklyCalendarComplete = coverage.ok;
    weeklyCalendarNote = coverage.error;
  }

  const weeklyRawRows =
    displayWeeklyRange && (reportType === "WEEKLY" || reportType === "DAILY")
      ? filterNreRowsByDateRange(filtered, displayWeeklyRange)
      : (split.weeklyRawRows ?? []);

  if (weeklyRawRows.length > 0 && report.campaignSlides.length > 0 && (reportType === "WEEKLY" || reportType === "DAILY")) {
    const csvWeeklySpend = sumSpend(weeklyRawRows as MetricRow[]);
    const csvStdWeeklyResults = sumResultsForLabelFromRawDailyRows(
      weeklyRawRows,
      reportObjectiveMap,
      resultLabel,
      "standard",
    );
    const csvWeeklyResults = sumResultsForLabelFromRawDailyRows(
      weeklyRawRows,
      reportObjectiveMap,
      resultLabel,
      countingMode,
    );
    const csvExportWeeklyResults = sumResultsForLabelFromRawDailyRows(
      weeklyRawRows,
      reportObjectiveMap,
      resultLabel,
      "meta-csv-export",
    );
    const reportWeeklySpend = reportPeriodSpendFromSlides(report);
    const reportWeeklyResults = reportPeriodResultsFromSlides(report, resultLabel);
    const reportWeeklyCpr =
      reportWeeklyResults > 0 && reportWeeklySpend > 0 ? reportWeeklySpend / reportWeeklyResults : 0;
    const slideCpr =
      reportWeeklyCpr > 0
        ? fmtCurrency(reportWeeklyCpr, currencySymbol)
        : (report.campaignSlides.find((s) => s.resultLabel === resultLabel)?.metrics.cpr ?? "—");
    // Campaign slides show CPR as total period spend ÷ results (see
    // reportWeeklyCpr below). Attributed spend excludes zero-result days that
    // still count toward Ad Spend — using it here falsely showed ~$10 vs ~$17.
    const csvWeeklyCpr =
      csvWeeklyResults > 0 && csvWeeklySpend > 0 ? csvWeeklySpend / csvWeeklyResults : 0;
    const weeklyScope =
      reportType === "DAILY"
        ? displayWeeklyRange
          ? `Selected day(s) (${getDateRangeAbbrLabel(displayWeeklyRange.startIso, displayWeeklyRange.endIso)})`
          : "Selected day(s)"
        : displayWeeklyRange
          ? `Report week (${getDateRangeAbbrLabel(displayWeeklyRange.startIso, displayWeeklyRange.endIso)})`
          : "Report week";

    if (!weeklyCalendarComplete && displayWeeklyRange) {
      checks.push({
        metric: "Daily rows in report week",
        scope: weeklyScope,
        reportDisplay: `${displayWeeklyRange.startIso} – ${displayWeeklyRange.endIso}`,
        csvDisplay: "Missing days",
        status: "mismatch",
        note: weeklyCalendarNote,
      });
    }

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
        calendarComplete: weeklyCalendarComplete,
        calendarIncompleteNote: weeklyCalendarNote,
        cprReportSpend: reportWeeklySpend,
        cprCsvSpend: csvWeeklySpend,
      }),
    );

    for (const slide of report.campaignSlides) {
      const campRaw = (weeklyRawRows as MetricRow[]).filter(
        (r) => normalizeCampaignName(r.campaign_name ?? "") === normalizeCampaignName(slide.campaignName),
      );
      const campaignSuffix =
        report.campaignSlides.length > 1
          ? slide.campaignName.length > 36
            ? `${slide.campaignName.slice(0, 33)}…`
            : slide.campaignName
          : undefined;
      appendCtrCpcChecks({
        checks,
        scope: weeklyScope,
        rawRows: campRaw,
        reportCtrDisplay: slide.metrics.ctr,
        reportCpcDisplay: slide.metrics.cpc,
        currencySymbol,
        calendarComplete: weeklyCalendarComplete,
        campaignSuffix,
      });
      const { linkClicks, cplc } = linkClickMetricsFromSlide(slide);
      appendLinkClickCpcChecks({
        checks,
        scope: weeklyScope,
        rawRows: campRaw,
        reportLinkClicksDisplay: linkClicks,
        reportCplcDisplay: cplc,
        currencySymbol,
        calendarComplete: weeklyCalendarComplete,
        campaignSuffix,
      });
    }

    for (const adSlide of report.adSetSlides) {
      const adRaw = filterWeeklyRawForAdSet(weeklyRawRows, adSlide.campaignName, adSlide.adSetName);
      appendAdSetSlideChecks({
        checks,
        parentScope: weeklyScope,
        currencySymbol,
        adSlide,
        rawRows: adRaw,
        objectiveMap: reportObjectiveMap,
        countingMode,
        calendarComplete: weeklyCalendarComplete,
        calendarIncompleteNote: weeklyCalendarNote,
      });
    }
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
    const chartRaw = filterRawRowsToRange(filtered, capped.startIso, capped.endIso);
    const chartRows: MetricRow[] = aggregateRows(chartRaw);
    const chartObjectiveMap = buildChartWindowObjectiveMap(reportObjectiveMap, chartRows, pinned);

    const csvChartSpend = sumSpend(chartRaw as MetricRow[]);
    const csvStdChartResults = sumResultsForLabelFromRawDailyRows(
      chartRaw,
      chartObjectiveMap,
      resultLabel,
      "standard",
    );
    const csvChartResults = sumResultsForLabelFromRawDailyRows(
      chartRaw,
      chartObjectiveMap,
      resultLabel,
      countingMode,
    );
    const csvExportChartResults = sumResultsForLabelFromRawDailyRows(
      chartRaw,
      chartObjectiveMap,
      resultLabel,
      "meta-csv-export",
    );
    const chartAttributedSpend = attributedSpendForLabelFromRawDailyRows(
      chartRaw,
      chartObjectiveMap,
      resultLabel,
      countingMode,
    );

    const chartObjectiveEntry = report.chart.snapshot.objectives.find((o) => o.label === resultLabel);
    const reportChartResults = chartObjectiveEntry ? parseCellNum(chartObjectiveEntry.resultsValue) : 0;
    const reportChartSpend = report.chart.totalAllSpend;
    const reportChartAttributed = attributedSpendForLabelFromRawDailyRows(
      chartRaw,
      chartObjectiveMap,
      resultLabel,
      countingMode,
    );
    const reportChartCpr =
      reportChartResults > 0 && reportChartAttributed > 0
        ? reportChartAttributed / reportChartResults
        : chartObjectiveEntry
          ? parseCellNum(chartObjectiveEntry.cprValue)
          : 0;
    const csvChartCpr =
      csvChartResults > 0 && chartAttributedSpend > 0 ? chartAttributedSpend / csvChartResults : 0;

    const chartScope = report.chart.periodSubLabel
      ? `Last 30 days (${report.chart.periodSubLabel})`
      : "Last 30 days (chart)";
    checks.push(
      ...scopedChecks({
        scope: chartScope,
        currencySymbol,
        reportSpend: reportChartSpend,
        csvSpend: csvChartSpend,
        reportSpendDisplay: fmtCurrency(reportChartSpend, currencySymbol),
        resultLabel,
        costLabel,
        reportResults: reportChartResults,
        csvResults: csvChartResults,
        reportResultsDisplay: chartObjectiveEntry?.resultsValue ?? fmtNumber(reportChartResults),
        reportCpr: reportChartCpr,
        csvCpr: csvChartCpr,
        reportCprDisplay:
          reportChartResults > 0 && reportChartSpend > 0
            ? fmtCurrency(reportChartCpr, currencySymbol)
            : (chartObjectiveEntry?.cprValue ?? "—"),
        canAlignRef,
        csvStandardResults: csvStdChartResults,
        csvExportResults: csvExportChartResults,
        countingMode,
        cprReportSpend: reportChartAttributed,
        cprCsvSpend: chartAttributedSpend,
      }),
    );
  }

  if (checks.length === 0) {
    return { status: "skipped", checks: [] };
  }

  const hasMismatch = checks.some((c) => c.status === "mismatch");
  return finalizeVerificationResult({
    checks,
    primaryResultLabel: resultLabel,
    canAlignRef,
    countingMode,
  });
}

function finalizeVerificationResult(params: {
  checks: CsvVerificationCheck[];
  primaryResultLabel?: string;
  canAlignRef: { value: boolean };
  countingMode: ResultCountingMode;
}): CsvVerificationResult {
  const hasMismatch = params.checks.some((c) => c.status === "mismatch");
  const scopesVerified = [...new Set(params.checks.map((c) => c.scope))];
  return {
    status: hasMismatch ? "mismatch" : "ok",
    checks: params.checks,
    primaryResultLabel: params.primaryResultLabel,
    scopesVerified,
    canAlignWithCsvExport: hasMismatch && params.canAlignRef.value,
    alignedWithCsvExport: params.countingMode === "meta-csv-export",
  };
}

function sumComparisonPeriodFromRawRows(
  rows: NreRow[],
  objectiveMap: Map<string, ResultLabels>,
  mode: ResultCountingMode,
): { spend: number; results: number; cpr: number } {
  if (rows.length === 0) return { spend: 0, results: 0, cpr: 0 };
  const spend = sumSpend(rows as MetricRow[]);
  const byCampaign = new Map<string, NreRow[]>();
  for (const row of rows) {
    const name = (row.campaign_name || "Unknown Campaign").trim() || "Unknown Campaign";
    const list = byCampaign.get(name) ?? [];
    list.push(row);
    byCampaign.set(name, list);
  }
  let results = 0;
  for (const [name, campaignRows] of byCampaign) {
    const obj = objectiveMap.get(normalizeCampaignName(name)) ?? {
      resultLabel: "RESULTS",
      costLabel: "COST PER RESULT",
    };
    results += sumResultsForLabelFromRawDailyRows(campaignRows, objectiveMap, obj.resultLabel, mode);
  }
  const cpr = results > 0 ? spend / results : 0;
  return { spend, results, cpr };
}

export interface ReconcileComparisonReportInput {
  report: ComparisonReportData;
  mtdDailyRows: NreRow[];
  periodBSupplementalRows?: NreRow[] | null;
  selectedCampaigns: string[] | null | undefined;
  periodA: DateRangeIso;
  periodB: DateRangeIso;
  currencySymbol: string;
  resultCountingMode?: ResultCountingMode;
  campaignObjectives?: Record<string, ResultLabels> | null;
  platform?: Platform;
}

/** Comparison report — Period A and Period B totals vs CSV (same windows as buildComparisonReportData). */
export function reconcileComparisonReportWithCsv(input: ReconcileComparisonReportInput): CsvVerificationResult {
  if (input.platform && input.platform !== "META") {
    return { status: "skipped", checks: [], skipReason: NON_META_SKIP_REASON };
  }

  const filtered = filterRowsByCampaigns(input.mtdDailyRows, input.selectedCampaigns ?? null);
  const supplemental = input.periodBSupplementalRows?.length
    ? filterRowsByCampaigns(input.periodBSupplementalRows, input.selectedCampaigns ?? null)
    : undefined;

  const rowsA = filterNreRowsByDateRange(filtered, input.periodA);
  const rowsB = mergeComparisonPeriodRows(filtered, supplemental, input.periodB);
  if (rowsA.length === 0 && rowsB.length === 0) {
    return { status: "skipped", checks: [] };
  }

  const countingMode: ResultCountingMode = input.resultCountingMode ?? "standard";
  const canAlignRef = { value: false };
  const checks: CsvVerificationCheck[] = [];
  const objectiveMap = applyCampaignObjectiveOverrides(
    buildCampaignObjectiveMap(aggregateRows([...rowsA, ...rowsB])),
    input.campaignObjectives,
  );

  const csvA = sumComparisonPeriodFromRawRows(rowsA, objectiveMap, countingMode);
  const csvB = sumComparisonPeriodFromRawRows(rowsB, objectiveMap, countingMode);
  const csvStdA = sumComparisonPeriodFromRawRows(rowsA, objectiveMap, "standard");
  const csvStdB = sumComparisonPeriodFromRawRows(rowsB, objectiveMap, "standard");
  const csvExportA = sumComparisonPeriodFromRawRows(rowsA, objectiveMap, "meta-csv-export");
  const csvExportB = sumComparisonPeriodFromRawRows(rowsB, objectiveMap, "meta-csv-export");

  const resultMetric = "Results (all campaigns)";
  const costLabel = "COST PER RESULT";

  const periodScopes: { scope: string; report: ComparisonReportData["totals"]["metricsA"]; csv: typeof csvA; csvStd: number; csvExport: number }[] = [
    {
      scope: input.report.periodALabel,
      report: input.report.totals.metricsA,
      csv: csvA,
      csvStd: csvStdA.results,
      csvExport: csvExportA.results,
    },
    {
      scope: input.report.periodBLabel,
      report: input.report.totals.metricsB,
      csv: csvB,
      csvStd: csvStdB.results,
      csvExport: csvExportB.results,
    },
  ];

  for (const period of periodScopes) {
    checks.push(
      ...scopedChecks({
        scope: period.scope,
        currencySymbol: input.currencySymbol,
        reportSpend: period.report.spend.value,
        csvSpend: period.csv.spend,
        reportSpendDisplay: period.report.spend.formatted,
        resultLabel: resultMetric,
        costLabel,
        reportResults: period.report.results.value,
        csvResults: period.csv.results,
        reportResultsDisplay: period.report.results.formatted,
        reportCpr: period.report.cpr.value,
        csvCpr: period.csv.cpr,
        reportCprDisplay: period.report.cpr.formatted,
        canAlignRef,
        csvStandardResults: period.csvStd,
        csvExportResults: period.csvExport,
        countingMode,
      }),
    );
  }

  if (checks.length === 0) {
    return { status: "skipped", checks: [] };
  }

  return finalizeVerificationResult({ checks, primaryResultLabel: resultMetric, canAlignRef, countingMode });
}

export interface ReconcileHistoricalReportInput {
  report: HistoricalReportData;
  mtdDailyRows: NreRow[];
  selectedCampaigns: string[] | null | undefined;
  currencySymbol: string;
  resultCountingMode?: ResultCountingMode;
  campaignObjectives?: Record<string, ResultLabels> | null;
  platform?: Platform;
}

/** Multi-month report — each month total row vs CSV for that calendar month. */
export function reconcileHistoricalReportWithCsv(input: ReconcileHistoricalReportInput): CsvVerificationResult {
  if (input.platform && input.platform !== "META") {
    return { status: "skipped", checks: [], skipReason: NON_META_SKIP_REASON };
  }

  const filtered = filterRowsByCampaigns(input.mtdDailyRows, input.selectedCampaigns ?? null);
  if (filtered.length === 0 || input.report.comparisonRows.length === 0) {
    return { status: "skipped", checks: [] };
  }

  const countingMode: ResultCountingMode = input.resultCountingMode ?? "standard";
  const canAlignRef = { value: false };
  const checks: CsvVerificationCheck[] = [];
  let primaryLabel: string | undefined;

  for (const tableRow of input.report.comparisonRows) {
    if (!tableRow.hasData) continue;
    const monthRange = input.report.monthRanges.find((m) => m.fullMonthLabel === tableRow.monthLabel);
    if (!monthRange) continue;

    const monthRows = filterNreRowsByDateRange(filtered, monthRange);
    if (monthRows.length === 0) continue;

    const objectiveMap = applyCampaignObjectiveOverrides(buildCampaignObjectiveMap(monthRows), input.campaignObjectives);
    const col = primaryResultColumnFromTableRow(tableRow);
    if (!col) continue;
    primaryLabel = col.label;

    const csvSpend = sumSpend(monthRows as MetricRow[]);
    const csvStdResults = sumResultsForLabelFromRawDailyRows(monthRows, objectiveMap, col.label, "standard");
    const csvResults = sumResultsForLabelFromRawDailyRows(monthRows, objectiveMap, col.label, countingMode);
    const csvExportResults = sumResultsForLabelFromRawDailyRows(
      monthRows,
      objectiveMap,
      col.label,
      "meta-csv-export",
    );
    const attributedSpend = attributedSpendForLabelFromRawDailyRows(
      monthRows,
      objectiveMap,
      col.label,
      countingMode,
    );
    const csvCpr = csvResults > 0 && attributedSpend > 0 ? attributedSpend / csvResults : 0;

    checks.push(
      ...scopedChecks({
        scope: tableRow.monthLabel,
        currencySymbol: input.currencySymbol,
        reportSpend: parseCellNum(tableRow.spend),
        csvSpend,
        reportSpendDisplay: tableRow.spend,
        resultLabel: col.label,
        costLabel: col.costLabel,
        reportResults: parseCellNum(col.value),
        csvResults,
        reportResultsDisplay: col.value,
        reportCpr: parseCellNum(col.cprValue),
        csvCpr,
        reportCprDisplay: col.cprValue,
        canAlignRef,
        csvStandardResults: csvStdResults,
        csvExportResults: csvExportResults,
        countingMode,
      }),
    );
  }

  if (checks.length === 0) {
    return { status: "skipped", checks: [] };
  }

  return finalizeVerificationResult({ checks, primaryResultLabel: primaryLabel, canAlignRef, countingMode });
}

export interface ReconcileDayBreakdownReportInput {
  report: DayBreakdownReportData;
  mtdDailyRows: NreRow[];
  selectedCampaigns: string[] | null | undefined;
  currencySymbol: string;
  resultCountingMode?: ResultCountingMode;
  campaignObjectives?: Record<string, ResultLabels> | null;
  platform?: Platform;
}

/** Day-by-day table — range totals vs CSV for the selected window. */
export function reconcileDayBreakdownReportWithCsv(input: ReconcileDayBreakdownReportInput): CsvVerificationResult {
  if (input.platform && input.platform !== "META") {
    return { status: "skipped", checks: [], skipReason: NON_META_SKIP_REASON };
  }

  const filtered = filterRowsByCampaigns(input.mtdDailyRows, input.selectedCampaigns ?? null);
  const rowsInRange = filterNreRowsByDateRange(filtered, input.report.dateRange);
  if (rowsInRange.length === 0 || input.report.dayRows.every((r) => !r.hasData)) {
    return { status: "skipped", checks: [] };
  }

  const countingMode: ResultCountingMode = input.resultCountingMode ?? "standard";
  const canAlignRef = { value: false };
  const objectiveMap = applyCampaignObjectiveOverrides(buildCampaignObjectiveMap(rowsInRange), input.campaignObjectives);

  const sampleRow = input.report.dayRows.find((r) => r.hasData);
  const col = sampleRow ? primaryResultColumnFromTableRow(sampleRow) : null;
  if (!col) {
    return { status: "skipped", checks: [] };
  }

  let reportSpend = 0;
  let reportResults = 0;
  let weightedCpr = 0;
  let resultWeight = 0;
  for (const day of input.report.dayRows) {
    if (!day.hasData) continue;
    const dayCol = day.resultColumns.find((c) => c.label === col.label) ?? primaryResultColumnFromTableRow(day);
    if (!dayCol) continue;
    reportSpend += parseCellNum(day.spend);
    const r = parseCellNum(dayCol.value);
    reportResults += r;
    const cpr = parseCellNum(dayCol.cprValue);
    if (r > 0 && cpr > 0) {
      weightedCpr += cpr * r;
      resultWeight += r;
    }
  }
  const reportCpr = resultWeight > 0 ? weightedCpr / resultWeight : 0;

  const csvSpend = sumSpend(rowsInRange as MetricRow[]);
  const csvStdResults = sumResultsForLabelFromRawDailyRows(rowsInRange, objectiveMap, col.label, "standard");
  const csvResults = sumResultsForLabelFromRawDailyRows(rowsInRange, objectiveMap, col.label, countingMode);
  const csvExportResults = sumResultsForLabelFromRawDailyRows(
    rowsInRange,
    objectiveMap,
    col.label,
    "meta-csv-export",
  );
  const attributedSpend = attributedSpendForLabelFromRawDailyRows(
    rowsInRange,
    objectiveMap,
    col.label,
    countingMode,
  );
  const csvCpr = csvResults > 0 && attributedSpend > 0 ? attributedSpend / csvResults : 0;

  const checks = scopedChecks({
    scope: "Selected date range",
    currencySymbol: input.currencySymbol,
    reportSpend,
    csvSpend,
    reportSpendDisplay: fmtCurrency(reportSpend, input.currencySymbol),
    resultLabel: col.label,
    costLabel: col.costLabel,
    reportResults,
    csvResults,
    reportResultsDisplay: fmtNumber(reportResults),
    reportCpr,
    csvCpr,
    reportCprDisplay: reportCpr > 0 ? fmtCurrency(reportCpr, input.currencySymbol) : "—",
    canAlignRef,
    csvStandardResults: csvStdResults,
    csvExportResults: csvExportResults,
    countingMode,
  });

  return finalizeVerificationResult({ checks, primaryResultLabel: col.label, canAlignRef, countingMode });
}
