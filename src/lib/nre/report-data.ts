/**
 * NRE v1 — report data orchestrator.
 * Ports the pure-data-computation half of generateWeeklyReport() (and
 * fillPeriodSlide_ / fillMTDRow_ / fillCoverExtras_ / addVisualScorecardSlide_'s
 * data-prep) from meta_ads_report_v4.js into a single serialisable object.
 * Slide rendering (task 6) and AI prompt writing (task 7) consume this output
 * — this module does no I/O and no PPTX/AI concerns.
 *
 * Scope note: NextReport v1 only supports the spec's "Recommended" single
 * MTD-Daily-CSV download workflow (see claude_code_webapp_prompt.md), not the
 * separate legacy Weekly-CSV-tab fallback the Apps Script also supported —
 * so `splitMtdDaily` is always the ingestion path, matching the tested and
 * currently-used configuration.
 *
 * One intentional bug fix vs the source: writeInsights_() in the Apps Script
 * reads `resultsNum` (for the AI-prompt "cost per result" value on CAMPAIGN
 * SUMMARY slides only) one line before it is assigned, so that value is
 * always 0 → the AI prompt always sees cpr "—" for combined/campaign slides
 * regardless of actual performance. That never affects the slide's own
 * displayed METRIC_CPR (a separate, correctly-computed value) — only the
 * text fed to the AI. We reuse the already-correct display value instead of
 * reproducing the use-before-assignment bug.
 */

import type { AggRow } from "./aggregate";
import { splitMtdDaily } from "./aggregate";
import type { NreRow } from "./columns";
import { getDateRangeShortLabel, formatDateUS } from "./dates";
import { fmtCurrency, fmtCurrency2dp, fmtNumber, fmtPercent, parseCellNum } from "./format";
import { calculateAccountHealth, budgetSummaryLine } from "./health";
import {
  getGroupedResultDisplay,
  getResultGroups,
  getResultLabels,
  getSingleRowResultDisplay,
} from "./objective";
import type { MetricRow } from "./types";

// ─────────────────────────── Public types ──────────────────────────────────

export interface SlideMetrics {
  spend: string;
  reach: string;
  impressions: string;
  results: string;
  ctr: string;
  cpr: string;
  cpc: string;
}

export interface AiContext {
  ctx: string;
  spend: string;
  reach: string;
  results: string;
  cpr: string;
  ctr: string;
  cpc: string;
  resultLabel: string;
  costLabel: string;
  freq: number;
  resultsNum: number;
  hasResults: boolean;
}

export interface CampaignSlideData {
  kind: "campaign";
  campaignName: string;
  resultLabel: string;
  costLabel: string;
  metrics: SlideMetrics;
  dateRangeLine: string;
  avgFreq: number;
  ai: AiContext;
}

export interface AdSetSlideData {
  kind: "adset";
  campaignName: string;
  adSetName: string;
  resultLabel: string;
  costLabel: string;
  metrics: SlideMetrics;
  dateRangeLine: string;
  rowFreq: number;
  ai: AiContext;
}

export type SlideData = CampaignSlideData | AdSetSlideData;

export interface ChartCampaignData {
  name: string;
  spend: number;
  results: number;
  cpr: number;
  avgCtr: number;
  resLabel: string;
  cprLabel: string;
}

export interface ChartSlideData {
  periodLabel: "MTD" | "Weekly";
  campaigns: ChartCampaignData[];
  totalAllSpend: number;
  activeCampaignCount: number;
}

export interface TableRowData {
  hasData: boolean;
  monthLabel: string;
  spend: string;
  reach: string;
  impressions: string;
  ctr: string;
  cpc: string;
  result1: string;
  cpr1: string;
  result2: string;
  cpr2: string;
  g1Label: string;
  g1CprLabel: string;
  g2Label: string | null;
  g2CprLabel: string | null;
}

export interface TableHeaderLabels {
  result1Label: string;
  cpr1Label: string;
  result2Label: string;
  cpr2Label: string;
}

export interface CoverData {
  accountName: string;
  reportDate: string;
  dateRange: string;
  healthBadge: string;
  healthScore: number;
  budgetSummary: string;
}

export interface ReportData {
  isPaused: boolean;
  cover: CoverData;
  campaignSlides: CampaignSlideData[];
  adSetSlides: AdSetSlideData[];
  pausedMessage: string | null;
  chart: ChartSlideData | null;
  periodRow: TableRowData;
  mtdRow: TableRowData;
  tableHeaderLabels: TableHeaderLabels;
  fileDateRange: string;
}

export interface BuildReportDataInput {
  accountName: string;
  currencySymbol: string;
  timezone: string;
  monthlyBudget: number | null;
  /** Raw column-mapped rows from the "MTD Daily CSV" upload (required). */
  mtdDailyRows: NreRow[];
  /** Raw column-mapped rows from the optional "Period CSV" upload (previous full month). */
  periodRows?: NreRow[];
  now?: Date;
}

// ─────────────────────────── Helpers ───────────────────────────────────────

function average(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function rowFrequency(row: MetricRow): number {
  const explicit = parseCellNum(row.frequency);
  if (explicit > 0) return explicit;
  const reach = parseCellNum(row.reach);
  return reach > 0 ? parseCellNum(row.impressions) / reach : 0;
}

function freqLine(freq: number): string {
  if (freq <= 0) return "";
  return "\nFreq: " + freq.toFixed(1) + "x avg" + (freq > 3.5 ? " ⚠️ High" : "");
}

/**
 * Port of the cprShort()/cprShortLabel() closures shared by fillPeriodSlide_
 * and fillMTDRow_, extended (per product owner) to cover every label
 * getResultLabels() can actually produce — the source only handled
 * LPV/leads/clicks/results, so a PURCHASES- or CONVERSIONS-led account would
 * show its cost column header unabbreviated in the Combined Total table.
 */
function cprShort(label: string): string {
  return label
    .replace("LANDING PAGE VIEWS", "LPV")
    .replace("FORM LEADS", "CPL")
    .replace("WEB LEADS", "CPL")
    .replace("CLICKS", "CPC")
    .replace("PURCHASES", "CPP")
    .replace("REACH", "CP1K")
    .replace("VIDEO VIEWS", "CPV")
    .replace("CONVERSIONS", "CPA")
    .replace("RESULTS", "CPR");
}

/** Shared computation for the Period row and the MTD row of the 10-column table. */
function computeTableRow(rows: MetricRow[], currencySymbol: string): TableRowData {
  if (!rows || rows.length === 0) {
    return {
      hasData: false,
      monthLabel: "—",
      spend: "—",
      reach: "—",
      impressions: "—",
      ctr: "—",
      cpc: "—",
      result1: "0",
      cpr1: "—",
      result2: "—",
      cpr2: "—",
      g1Label: "RESULTS",
      g1CprLabel: "CPR",
      g2Label: null,
      g2CprLabel: null,
    };
  }

  let totalSpend = 0;
  let totalReach = 0;
  let totalImpr = 0;
  const ctrs: number[] = [];
  const cpcs: number[] = [];
  let rawStart = "";
  let rawEnd = "";

  rows.forEach((row) => {
    totalSpend += parseCellNum(row.spend);
    totalReach += parseCellNum(row.reach);
    totalImpr += parseCellNum(row.impressions);
    const ctr = parseCellNum(row.ctr);
    const cpc = parseCellNum(row.cpc);
    if (ctr > 0) ctrs.push(ctr);
    if (cpc > 0) cpcs.push(cpc);
    if (row.date_start && (!rawStart || row.date_start < rawStart)) rawStart = row.date_start;
    if (row.date_end && (!rawEnd || row.date_end > rawEnd)) rawEnd = row.date_end;
  });

  const avgCtr = average(ctrs);
  const avgCpc = average(cpcs);

  const REACH_LABELS = ["REACH", "REACH (TOTAL)"];
  const allGroups = getResultGroups(rows);
  const groups = allGroups.filter((g) => !REACH_LABELS.includes(g.label));
  const g1 = groups[0] || allGroups[0] || { label: "RESULTS", costLabel: "CPR", count: 0, avgCpr: 0 };
  const g2 = groups[1] || null;

  const monthLabel = rawStart ? getDateRangeShortLabel(rawStart, rawEnd) : "This Period";

  return {
    hasData: true,
    monthLabel,
    spend: fmtCurrency(totalSpend, currencySymbol),
    reach: fmtNumber(totalReach),
    impressions: fmtNumber(totalImpr),
    ctr: avgCtr > 0 ? fmtPercent(avgCtr) : "—",
    cpc: avgCpc > 0 ? fmtCurrency2dp(avgCpc, currencySymbol) : "—",
    result1: fmtNumber(g1.count),
    cpr1: g1.avgCpr > 0 ? fmtCurrency2dp(g1.avgCpr, currencySymbol) : "—",
    result2: g2 ? fmtNumber(g2.count) : "—",
    cpr2: g2 ? (g2.avgCpr > 0 ? fmtCurrency2dp(g2.avgCpr, currencySymbol) : "—") : "—",
    g1Label: g1.label,
    g1CprLabel: cprShort(g1.label),
    g2Label: g2 ? g2.label : null,
    g2CprLabel: g2 ? cprShort(g2.label) : null,
  };
}

// ─────────────────────────── Main entry point ──────────────────────────────

export function buildReportData(input: BuildReportDataInput): ReportData {
  const { accountName, currencySymbol, timezone, monthlyBudget, mtdDailyRows, periodRows, now = new Date() } = input;

  const split = splitMtdDaily(mtdDailyRows, now);
  const weeklyRows: AggRow[] = split?.weeklyRows ?? [];
  const mtdRows: AggRow[] = split?.mtdRows ?? [];
  const isPaused = weeklyRows.length === 0;

  // Global weekly date range across ALL campaigns — used on every slide so
  // reporting periods stay consistent even if one campaign started mid-week.
  let globalWeekStart = "";
  let globalWeekEnd = "";
  weeklyRows.forEach((r) => {
    if (r.date_start && (!globalWeekStart || r.date_start < globalWeekStart)) globalWeekStart = r.date_start;
    if (r.date_end && (!globalWeekEnd || r.date_end > globalWeekEnd)) globalWeekEnd = r.date_end;
  });
  const globalWeekDateRange = globalWeekStart && globalWeekEnd ? getDateRangeShortLabel(globalWeekStart, globalWeekEnd) : "";

  const fileStartDate = globalWeekStart ? formatDateUS(globalWeekStart) : "unknown";
  const fileEndDate = globalWeekEnd ? formatDateUS(globalWeekEnd) : "unknown";
  const fileDateRange =
    fileStartDate !== "unknown" && fileEndDate !== "unknown"
      ? fileStartDate + " to " + fileEndDate
      : "Date range unavailable";

  const reportDate = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  })
    .formatToParts(now)
    .reduce((acc, part) => {
      if (part.type === "month") acc.month = part.value;
      if (part.type === "day") acc.day = part.value;
      if (part.type === "year") acc.year = part.value;
      return acc;
    }, { month: "", day: "", year: "" } as { month: string; day: string; year: string });
  const reportDateStr = `${reportDate.month}-${reportDate.day}-${reportDate.year}`;

  // ── Cover ──────────────────────────────────────────────────────────────
  let cover: CoverData;
  if (isPaused) {
    cover = {
      accountName,
      reportDate: reportDateStr,
      dateRange: globalWeekDateRange || fileDateRange,
      healthBadge: "⚙️ Campaigns Paused",
      healthScore: 0,
      budgetSummary: "",
    };
  } else {
    const { score, badge } = calculateAccountHealth(weeklyRows);
    const mtdSpend = mtdRows.reduce((sum, r) => sum + parseCellNum(r.spend), 0);
    cover = {
      accountName,
      reportDate: reportDateStr,
      dateRange: globalWeekDateRange,
      healthBadge: badge,
      healthScore: score,
      budgetSummary: budgetSummaryLine(mtdSpend, monthlyBudget, currencySymbol, now),
    };
  }

  // ── Period row (row 2) + MTD row (row 3) of the 10-column table ─────────
  // Computed regardless of isPaused: fillPeriodSlide_/fillMTDRow_ in the
  // source run unconditionally after the phase-A slide-building block, so a
  // paused CURRENT month can still show real PREVIOUS month data if a Period
  // CSV was uploaded (mtdRow will naturally come back empty since mtdRows is
  // [] when paused).
  const periodRow = computeTableRow((periodRows ?? []) as MetricRow[], currencySymbol);
  const mtdRow = computeTableRow(mtdRows, currencySymbol);

  // Table header labels: fillMTDRow_ always runs after fillPeriodSlide_ in the
  // source and both write the same header cells, so MTD's labels win whenever
  // MTD has data; only fall back to the period row's labels if MTD is empty.
  const headerSource = mtdRow.hasData ? mtdRow : periodRow;
  const tableHeaderLabels: TableHeaderLabels = {
    result1Label: headerSource.g1Label,
    cpr1Label: headerSource.g1CprLabel,
    result2Label: headerSource.g2Label ?? "—",
    cpr2Label: headerSource.g2CprLabel ?? "—",
  };

  // ── Paused case: single message slide, no campaign/ad-set/chart slides ──
  if (isPaused) {
    const pausedMessage =
      "Campaigns for " + accountName + " were paused during the selected reporting " +
      "period and did not generate impressions, spend, or results. " +
      "No action has been taken on the account during this period.";

    return {
      isPaused: true,
      cover,
      campaignSlides: [],
      adSetSlides: [],
      pausedMessage,
      chart: null,
      periodRow,
      mtdRow,
      tableHeaderLabels,
      fileDateRange,
    };
  }

  // ── Campaign grouping ─────────────────────────────────────────────────
  // weeklyRows is sorted by campaign_name (localeCompare) — this governs
  // ad-set slide append order (Phase A2) and which rows land in which group.
  const sortedWeeklyRows = [...weeklyRows].sort((a, b) =>
    String(a.campaign_name || "").localeCompare(String(b.campaign_name || "")),
  );

  const campaignGroups: Record<string, AggRow[]> = {};
  sortedWeeklyRows.forEach((row) => {
    const name = String(row.campaign_name || "Unknown Campaign").trim();
    if (!campaignGroups[name]) campaignGroups[name] = [];
    campaignGroups[name].push(row);
  });
  // Campaign SUMMARY slide order uses plain default sort (not localeCompare) —
  // matches Object.keys(campaignGroups).sort() in the source exactly.
  const campaignNames = Object.keys(campaignGroups).sort();

  // ── Phase A1: campaign summary slides ────────────────────────────────
  const campaignSlides: CampaignSlideData[] = campaignNames.map((campaignName) => {
    const campRows = campaignGroups[campaignName];

    let totalSpend = 0;
    let totalReach = 0;
    let totalImpr = 0;
    const ctrs: number[] = [];
    const cpcs: number[] = [];
    campRows.forEach((row) => {
      totalSpend += parseCellNum(row.spend);
      totalReach += parseCellNum(row.reach);
      totalImpr += parseCellNum(row.impressions);
      const ctr = parseCellNum(row.ctr);
      const cpc = parseCellNum(row.cpc);
      if (ctr > 0) ctrs.push(ctr);
      if (cpc > 0) cpcs.push(cpc);
    });
    const avgCtr = average(ctrs);
    const avgCpc = average(cpcs);
    const { resultLabel, costLabel, resultValue, cprValue } = getGroupedResultDisplay(campRows, currencySymbol);

    let totalFreq = 0;
    let freqRows = 0;
    campRows.forEach((row) => {
      const f = rowFrequency(row);
      if (f > 0) {
        totalFreq += f;
        freqRows++;
      }
    });
    const avgFreq = freqRows > 0 ? totalFreq / freqRows : 0;

    const totalResults = campRows.reduce((sum, r) => sum + parseCellNum(r.results), 0);

    const metrics: SlideMetrics = {
      spend: fmtCurrency(totalSpend, currencySymbol),
      reach: fmtNumber(totalReach),
      impressions: fmtNumber(totalImpr),
      results: resultValue,
      ctr: avgCtr > 0 ? fmtPercent(avgCtr) : "—",
      cpr: cprValue,
      cpc: avgCpc > 0 ? fmtCurrency2dp(avgCpc, currencySymbol) : "—",
    };

    return {
      kind: "campaign",
      campaignName,
      resultLabel,
      costLabel,
      metrics,
      dateRangeLine: globalWeekDateRange + freqLine(avgFreq),
      avgFreq,
      ai: {
        ctx: campaignName + " (combined " + campRows.length + " ad sets)",
        spend: metrics.spend,
        reach: metrics.reach,
        results: fmtNumber(totalResults),
        cpr: metrics.cpr, // see file header: reuses the correctly-computed display value
        ctr: metrics.ctr,
        cpc: metrics.cpc,
        resultLabel,
        costLabel,
        freq: avgFreq,
        resultsNum: totalResults,
        hasResults: totalResults > 0,
      },
    };
  });

  // ── Phase A2: individual ad set slides (only campaigns with 2+ ad sets) ─
  const adSetSlides: AdSetSlideData[] = [];
  sortedWeeklyRows.forEach((row) => {
    const campaignName = String(row.campaign_name || "Campaign").trim();
    const adSetName = String(row.ad_set_name || "").trim();
    const campAdSetCount = campaignGroups[campaignName]?.length || 0;
    if (campAdSetCount <= 1) return; // single ad set — campaign slide already covers it

    const { resultLabel, costLabel, resultValue, cprValue } = getSingleRowResultDisplay(row, currencySymbol);
    const rowFreq = rowFrequency(row);

    const rowSpend = parseCellNum(row.spend);
    const rowReach = parseCellNum(row.reach);
    const rowImpr = parseCellNum(row.impressions);
    const rowCtr = parseCellNum(row.ctr);
    const rowCpc = parseCellNum(row.cpc);

    const metrics: SlideMetrics = {
      spend: fmtCurrency(rowSpend, currencySymbol),
      reach: fmtNumber(rowReach),
      impressions: fmtNumber(rowImpr),
      results: resultValue,
      ctr: rowCtr > 0 ? fmtPercent(rowCtr) : "—",
      cpr: cprValue,
      cpc: rowCpc > 0 ? fmtCurrency2dp(rowCpc, currencySymbol) : "—",
    };

    adSetSlides.push({
      kind: "adset",
      campaignName,
      adSetName,
      resultLabel,
      costLabel,
      metrics,
      dateRangeLine: globalWeekDateRange + freqLine(rowFreq),
      rowFreq,
      ai: {
        ctx: campaignName + (adSetName ? " / " + adSetName : ""),
        spend: fmtCurrency(row.spend, currencySymbol),
        reach: fmtNumber(row.reach),
        results: fmtNumber(row.results),
        cpr: fmtCurrency2dp(row.cpr, currencySymbol),
        ctr: fmtPercent(row.ctr),
        cpc: fmtCurrency2dp(row.cpc, currencySymbol),
        resultLabel,
        costLabel,
        freq: rowFreq,
        resultsNum: parseCellNum(row.results),
        hasResults: parseCellNum(row.results) > 0,
      },
    });
  });

  // ── MTD performance chart slide ──────────────────────────────────────
  // Uses MTD data (always present alongside weekly in the single-download
  // workflow), grouped by campaign — chart circle order = default sort.
  // (TYPE_COLOR label→color mapping from addVisualScorecardSlide_ lives in
  // the PPTX render layer, task 6, since it's a pure rendering concern.)
  const chartGroups: Record<string, AggRow[]> = {};
  mtdRows.forEach((row) => {
    const name = String(row.campaign_name || "").trim();
    if (!chartGroups[name]) chartGroups[name] = [];
    chartGroups[name].push(row);
  });
  const chartCampaignNames = Object.keys(chartGroups).sort();

  let totalAllSpend = 0;
  const chartCampaigns: ChartCampaignData[] = chartCampaignNames.map((name) => {
    const rows = chartGroups[name] || [];
    const spend = rows.reduce((s, r) => s + parseCellNum(r.spend), 0);
    const results = rows.reduce((s, r) => s + parseCellNum(r.results), 0);
    const reach = rows.reduce((s, r) => s + parseCellNum(r.reach), 0);
    const ctrs = rows.map((r) => parseCellNum(r.ctr)).filter((v) => v > 0);
    const avgCtr = average(ctrs);
    // Port of addVisualScorecardSlide_'s per-campaign result-type detection —
    // based on the FIRST row's result_type only, not an aggregate across rows.
    const rt = rows[0] ? rows[0].result_type || "" : "";
    const { resultLabel: resLabel, costLabel: cprLabel } = getResultLabels(rt);
    // Same REACH fix as getResultGroups (objective.ts): a real Reach
    // objective typically has 0 in the results column, so cost-per-1K-reach
    // is computed from reach directly instead of showing a dash/0.
    let cpr: number;
    if (resLabel === "REACH" && results === 0) {
      cpr = reach > 0 ? (spend * 1000) / reach : 0;
    } else {
      const rawCpr = results > 0 ? spend / results : 0;
      cpr = resLabel === "REACH" ? rawCpr * 1000 : rawCpr;
    }
    totalAllSpend += spend;
    return { name, spend, results, cpr, avgCtr, resLabel, cprLabel };
  });

  const chart: ChartSlideData = {
    periodLabel: "MTD",
    campaigns: chartCampaigns,
    totalAllSpend,
    activeCampaignCount: chartCampaigns.filter((d) => d.spend > 0).length,
  };

  return {
    isPaused: false,
    cover,
    campaignSlides,
    adSetSlides,
    pausedMessage: null,
    chart,
    periodRow,
    mtdRow,
    tableHeaderLabels,
    fileDateRange,
  };
}
