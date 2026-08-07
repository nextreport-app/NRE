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
import { adSetKey, filterRowsByAdSets } from "./ad-sets";
import { filterRowsByCampaigns } from "./campaigns";
import type { NreRow } from "./columns";
import type { DateRangeIso } from "./date-range";
import {
  campaignStatusIndicator,
  deliveryStatusIndicator,
  isActiveDeliveryStatus,
  isArchivedDeliveryStatus,
  type DeliveryStatusIndicator,
} from "./delivery-status";
import { getDateRangeShortLabel, formatDateUS, getMonthName, getMonthYearLabel, parseDate } from "./dates";
import { fmtCurrency, fmtCurrency2dp, fmtNumber, fmtPercent, parseCellNum } from "./format";
import { calculateAccountHealth, budgetSummaryLine } from "./health";
import {
  getGroupedResultDisplay,
  getResultGroups,
  getResultLabels,
  getSingleRowResultDisplay,
} from "./objective";
import type { MetricRow } from "./types";
import type { DynamicMetricValue } from "./dynamic-metrics";
import { buildMetaSlots } from "./slot-assignment";

/** Re-exported from dynamic-metrics.ts (its canonical home) so existing `import { DynamicMetricValue } from "./report-data"` call sites keep working. */
export type { DynamicMetricValue };

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
  /** The weekly reporting window as a plain human-readable range (e.g. "July 13 - July 19") — the AI prompt's {date_range} field. Unlike the slide's own dateRangeLine, never has the "\nAd Frequency: ..." suffix appended. */
  dateRange: string;
  spend: string;
  reach: string;
  impressions: string;
  results: string;
  cpr: string;
  ctr: string;
  cpc: string;
  resultLabel: string;
  costLabel: string;
  freq: number;
  resultsNum: number;
  hasResults: boolean;
  /** Raw spend for this slide (same value `spend` formats for display) — drives generate-insights.ts's zero-spend/paused-campaign check, which needs a number, not a currency-formatted string. */
  spendNum: number;
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
  /** Small "Paused"/"Inactive" tag next to the campaign name; null when active or the CSV has no delivery-status data. */
  statusIndicator: DeliveryStatusIndicator;
  /**
   * The campaign template's 7 fixed card slots, automatically assigned by
   * the engine (slot-assignment.ts's buildMetaSlots) — no wizard step or
   * user input involved. Always exactly 7 entries, in physical slot order
   * 1-7; see pptx/fill-tags.ts's buildCampaignOrAdSetSlideXml, which maps
   * each entry straight onto the template's corresponding card position.
   */
  dynamicMetrics: DynamicMetricValue[];
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
  /** Small "Paused"/"Inactive" tag next to the ad set name; null when active or the CSV has no delivery-status data. */
  statusIndicator: DeliveryStatusIndicator;
  /** See CampaignSlideData.dynamicMetrics. */
  dynamicMetrics: DynamicMetricValue[];
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
  isActive: boolean;
  /** Small on-chart label ("Paused"/"Inactive") shown under the campaign name when not active; null when active or the CSV has no delivery-status data. */
  statusIndicator: DeliveryStatusIndicator;
}

export interface ChartSlideData {
  periodLabel: "MTD" | "Weekly";
  campaigns: ChartCampaignData[];
  totalAllSpend: number;
  activeCampaignCount: number;
  /** Drives the chart slide's title — see mtdMonthName. */
  reportType: ReportType;
  /** Calendar month name of the MTD data (e.g. "July"), from mtdRow.monthName. Whenever available, the chart title reads "[mtdMonthName] Campaign Performance" instead of the all-caps "MTD/WEEKLY CAMPAIGN PERFORMANCE" fallback — "MTD" is jargon clients don't recognize, and the actual month name reads clearly regardless of report type. */
  mtdMonthName: string | null;
  /**
   * The clarifying sub-line shown directly under the chart title — the
   * literal date span for a Weekly report ("July 27 - August 2, 2026"), or
   * "Full Month — [Month] [Year]" for a Monthly report. Empty string when
   * there's no usable date data (e.g. a paused/zero-data report) — the chart
   * slide renders no sub-line at all in that case, rather than a blank gap.
   */
  periodSubLabel: string;
}

export interface ResultColumnData {
  label: string;
  costLabel: string;
  value: string;
  cprValue: string;
}

export interface TableRowData {
  hasData: boolean;
  monthLabel: string;
  /** Calendar month name this row's data falls in (e.g. "July"), or null when hasData is false. Computed once here rather than re-parsed out of monthLabel's already-formatted text — used to detect when the Previous Month row and MTD row land in the same calendar month. */
  monthName: string | null;
  /**
   * Only ever set true on the Previous Month row (always false on the MTD
   * row itself — it's meaningless there, but both rows share this type).
   * True when this row's month matches the MTD row's month — e.g. a report
   * generated on the 1st, before the new month's MTD Daily CSV has any
   * real data of its own yet. Set by buildReportData once both rows exist
   * to compare, not computed here in isolation. The render layer
   * (fill-tags.ts's buildTableSlideXml) hides the MTD row entirely when
   * this is true, rather than showing two near-identical rows.
   */
  sameMonthAsCurrentMTD: boolean;
  spend: string;
  reach: string;
  impressions: string;
  ctr: string;
  cpc: string;
  /**
   * One entry per distinct objective present in this row's own data, in
   * getResultGroups' count-desc order — always at least one (a generic
   * RESULTS/COST PER RESULT placeholder when the row has no rows at all).
   * Not capped at 2: Fix 1 (product owner spec) requires every objective
   * running simultaneously to get its own column pair on the Combined
   * Total table, however many there are — a campaign mix of Link Clicks +
   * Meta Form Leads + Reach must show all three, not silently drop one.
   */
  resultColumns: ResultColumnData[];
}

export interface TableHeaderLabels {
  /** One {label, costLabel} pair per result-column the Combined Total table needs — the union of every objective present in EITHER the Period or MTD row, since both rows render under one shared header (see buildReportData's tableHeaderLabels computation for why a union, not just one row's own columns). */
  resultColumns: { label: string; costLabel: string }[];
}

export interface CoverData {
  accountName: string;
  reportDate: string;
  dateRange: string;
  healthBadge: string;
  healthScore: number;
  budgetSummary: string;
}

/**
 * Flagged when a campaign's objective was only resolved via Step 3 (data
 * values) or Step 4 (generic fallback) of the priority chain — i.e. neither
 * the CSV's result_type column nor a recognized objective-specific column
 * name gave a confident answer, so the detection is a best-effort guess.
 * Drives the amber "Objective auto-detected as ..." warning on the upload
 * wizard's preview step.
 */
export interface ObjectiveWarning {
  campaignName: string;
  detectedLabel: string;
}

/**
 * Weekly (default): campaign/ad-set slides + the MTD chart slide are built
 * from the trailing-7-day (or wizard-selected custom) window, alongside the
 * always-MTD chart and Combined Total table's 2 rows (Period + MTD).
 * Monthly: no separate weekly window at all — campaign/ad-set slides use
 * the full month-to-date data directly (same rows the MTD chart and
 * Combined Total table's MTD row already use), the cover title says
 * "MONTHLY PERFORMANCE REPORT", the health score badge says "Monthly" not
 * "Weekly", and the Combined Total table shows only its MTD row (see
 * pptx/fill-tags.ts's buildTableSlideXml).
 */
export type ReportType = "WEEKLY" | "MONTHLY";

/** Which ad platform this report's data came from — drives template selection and a handful of label/prompt differences in the render and AI layers. Defaults to "META" everywhere in this file; only google-report-data.ts's buildGoogleReportData ever produces "GOOGLE". */
export type Platform = "META" | "GOOGLE";

export interface ReportData {
  isPaused: boolean;
  platform: Platform;
  reportType: ReportType;
  cover: CoverData;
  campaignSlides: CampaignSlideData[];
  adSetSlides: AdSetSlideData[];
  pausedMessage: string | null;
  chart: ChartSlideData | null;
  periodRow: TableRowData;
  mtdRow: TableRowData;
  tableHeaderLabels: TableHeaderLabels;
  fileDateRange: string;
  objectiveWarnings: ObjectiveWarning[];
}

export interface BuildReportDataInput {
  accountName: string;
  currencySymbol: string;
  timezone: string;
  monthlyBudget: number | null;
  /** Raw column-mapped rows from the "MTD Daily CSV" upload (required). */
  mtdDailyRows: NreRow[];
  /** Raw column-mapped rows from the client's optional Previous Month Data upload (previous full month) — see lib/nre/previous-month-data.ts. */
  periodRows?: NreRow[];
  /**
   * Campaign names selected in the report upload wizard's campaign-selection
   * step. Filtered out of mtdDailyRows before any aggregation or date
   * splitting — an excluded campaign never reaches the NRE engine, not just
   * hidden from the final report. `undefined`/`null` means no selection was
   * made (e.g. a client that predates the feature) — every campaign passes.
   */
  selectedCampaigns?: string[] | null;
  /**
   * Ad set composite keys (see ad-sets.ts's adSetKey) selected in the
   * wizard's ad-set-selection step, which runs right after campaign
   * selection. Applied after selectedCampaigns filtering, same
   * never-reaches-the-engine guarantee. `undefined`/`null` means no
   * selection was made — every ad set passes.
   */
  selectedAdSets?: string[] | null;
  /**
   * Explicit weekly window from the wizard's date-range step — drives the
   * campaign slides, ad-set slides, and MTD chart slide. `undefined` keeps
   * the default "7 days ending yesterday" auto-computation. Never affects
   * MTD, which always covers the full reporting month regardless. Ignored
   * entirely when `reportType` is "MONTHLY" (no weekly window at all).
   */
  weeklyRange?: DateRangeIso;
  /** See the ReportType doc comment above. Defaults to "WEEKLY". */
  reportType?: ReportType;
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
  return "\nAd Frequency: " + freq.toFixed(1) + "x avg" + (freq > 3.5 ? " ⚠️ High" : "");
}

/**
 * Shared computation for the Period row and the MTD row of the 10-column
 * table. `isMtdRow` marks the MTD-Daily-CSV row, which is per-day data, and
 * drives the month label getting an " MTD" suffix (e.g. "Jul 1 - Jul 23
 * MTD") so it reads clearly as a partial, still-in-progress month rather
 * than a completed one like the Period row's.
 *
 * Reach is a straight sum of every row's reach value for both rows, even
 * though for the MTD row that's summing per-day numbers and Meta re-counts
 * the same person on each day they saw an ad — a deliberate, known
 * approximation (product decision, not an oversight): every other reporting
 * tool agencies/clients use does the same, and a dash here reads as "no
 * data" rather than "this number is approximate," which was actively
 * confusing. Only Reach gets this treatment; CTR/CPC stay true averages, not
 * sums, since those aren't meaningful summed.
 */
function computeTableRow(rows: MetricRow[], currencySymbol: string, isMtdRow: boolean): TableRowData {
  if (!rows || rows.length === 0) {
    return {
      hasData: false,
      monthLabel: "—",
      monthName: null,
      sameMonthAsCurrentMTD: false,
      spend: "—",
      reach: "—",
      impressions: "—",
      ctr: "—",
      cpc: "—",
      resultColumns: [{ label: "RESULTS", costLabel: "COST PER RESULT", value: "0", cprValue: "—" }],
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

  // Every distinct objective present in this row's own data becomes its own
  // column pair — Reach included: it used to be filtered out here unless it
  // was the ONLY objective present, on the assumption a fixed 2-column table
  // couldn't spare room for it alongside real conversion objectives. Now
  // that the table grows to fit (Fix 1), that exclusion no longer applies —
  // Reach just naturally sorts last most of the time (Meta doesn't populate
  // a `results` count for it, so its count is usually 0, same as any other
  // group with no results yet).
  const allGroups = getResultGroups(rows);

  const rawMonthLabel = rawStart ? getDateRangeShortLabel(rawStart, rawEnd) : "This Period";
  const monthName = rawStart ? getMonthName(rawStart) : null;

  // MTD row: "July 1 - July 26, 2026 MTD" — the year is added (Fix 2) for
  // clarity alongside the Previous Month row's own "Month Year" label
  // below. MTD never crosses a calendar month boundary (it's month-to-date
  // by definition), so either endpoint's year is the same; rawEnd is
  // preferred simply as the more "current" of the two.
  //
  // Previous Month row: "Previous Month — July 2026" (Fix 1) rather than
  // the raw date range — this makes it immediately clear the row comes
  // from the separate Previous Month Data upload, not the MTD Daily CSV,
  // which the date-range-only label didn't communicate on its own.
  let monthLabel: string;
  if (isMtdRow) {
    const year = parseDate(rawEnd || rawStart)?.year;
    monthLabel = year ? `${rawMonthLabel}, ${year} MTD` : `${rawMonthLabel} MTD`;
  } else {
    const monthYear = rawStart ? getMonthYearLabel(rawStart) : null;
    monthLabel = monthYear ? `Previous Month — ${monthYear}` : "Previous Month";
  }

  return {
    hasData: true,
    monthLabel,
    monthName,
    // Set false here unconditionally — buildReportData overrides this on
    // the Previous Month row specifically, once both rows exist to compare
    // months against each other (this function only ever sees one row's
    // own data at a time).
    sameMonthAsCurrentMTD: false,
    spend: fmtCurrency(totalSpend, currencySymbol),
    reach: fmtNumber(totalReach),
    impressions: fmtNumber(totalImpr),
    ctr: avgCtr > 0 ? fmtPercent(avgCtr) : "—",
    cpc: avgCpc > 0 ? fmtCurrency2dp(avgCpc, currencySymbol) : "—",
    resultColumns: allGroups.map((g) => ({
      label: g.label,
      // The real costLabel from getResultLabels() (e.g. "COST PER LEAD",
      // "COST PER SUBSCRIPTION") — the Combined Total table always shows
      // the actual objective's cost label, never an abbreviation.
      costLabel: g.costLabel,
      value: fmtNumber(g.count),
      cprValue: g.avgCpr > 0 ? fmtCurrency2dp(g.avgCpr, currencySymbol) : "—",
    })),
  };
}

/**
 * The Combined Total ("Campaign Overview") slide's table is 3 rows × (6 +
 * 2 per objective) columns — 6 static columns are always the same; this is
 * the single, explicit source of truth for those and for the grid's overall
 * shape, consumed positionally by the PPTX render layer (see
 * pptx/table-slide.ts) so a column can never silently disappear: the render
 * layer validates the template's actual table against this same shape and
 * throws if they ever drift apart (or grows/shrinks the table to match —
 * see table-slide.ts's file header) instead of quietly dropping whatever
 * doesn't line up.
 *
 * Column order: Month, Ad Spend, Reach, Impressions, CTR (All), CPC (All),
 * then one [label, cost label] pair per entry in headers.resultColumns —
 * however many objectives are running (Fix 1: never capped at 2, so a
 * Link Clicks + Meta Form Leads + Reach account gets 3 pairs, not 2 with the
 * third dropped). This is a direct positional mapping of TableRowData's own
 * field order, so adding/reordering a TableRowData field must be a
 * deliberate, visible change here too, not something that happens to line
 * up implicitly.
 */
export const COMBINED_TOTAL_STATIC_HEADERS = [
  "Month",
  "Ad Spend",
  "Reach",
  "Impressions",
  "CTR (All)",
  "CPC (All)",
] as const;

export function buildCombinedTotalTableGrid(
  periodRow: TableRowData,
  mtdRow: TableRowData,
  headers: TableHeaderLabels,
): string[][] {
  const headerRow = [
    ...COMBINED_TOTAL_STATIC_HEADERS,
    ...headers.resultColumns.flatMap((c) => [c.label, c.costLabel]),
  ];
  const dataRow = (row: TableRowData): string[] => {
    // Looked up by objective LABEL, not position: a row's own resultColumns
    // can be a different subset/order than the shared header (e.g. the
    // Period row ran a different objective mix than MTD) — "—" for any
    // header column this particular row has no data for, same as the old
    // fixed 2-column version did for an unused second objective.
    const byLabel = new Map(row.resultColumns.map((c) => [c.label, c]));
    const resultCells = headers.resultColumns.flatMap(({ label }) => {
      const col = byLabel.get(label);
      return col ? [col.value, col.cprValue] : ["—", "—"];
    });
    return [row.monthLabel, row.spend, row.reach, row.impressions, row.ctr, row.cpc, ...resultCells];
  };
  return [headerRow, dataRow(periodRow), dataRow(mtdRow)];
}

// ─────────────────────────── Main entry point ──────────────────────────────

export function buildReportData(input: BuildReportDataInput): ReportData {
  const {
    accountName,
    currencySymbol,
    timezone,
    monthlyBudget,
    mtdDailyRows,
    periodRows,
    selectedCampaigns,
    selectedAdSets,
    weeklyRange,
    reportType = "WEEKLY",
    now = new Date(),
  } = input;
  const isMonthlyReport = reportType === "MONTHLY";

  const campaignFilteredRows = filterRowsByCampaigns(mtdDailyRows, selectedCampaigns ?? null);
  const filteredMtdDailyRows = filterRowsByAdSets(campaignFilteredRows, selectedAdSets ?? null);
  // A Monthly report has no weekly window at all — weeklyRange is ignored
  // (never even resolved by the caller in that case) and splitMtdDaily's
  // own weekly split is simply never used below (see primaryRows).
  const split = splitMtdDaily(filteredMtdDailyRows, now, weeklyRange ? { weeklyRange } : {});

  // The optional Previous Month Data (previous full month) feeds the table
  // slide's separate "Period" row — it must go through the exact same
  // campaign/ad-set selection as the MTD Daily CSV, or a deselected ad set
  // still reaches the report via this second row even though the MTD row
  // correctly excludes it.
  const filteredPeriodRows = filterRowsByAdSets(
    filterRowsByCampaigns(periodRows ?? [], selectedCampaigns ?? null),
    selectedAdSets ?? null,
  );
  const weeklyRows: AggRow[] = split?.weeklyRows ?? [];
  const mtdRows: AggRow[] = split?.mtdRows ?? [];
  // The rows campaign/ad-set slides, the health score, and the report-wide
  // date range are all built from — the trailing-7-day (or custom) window
  // normally, or the full MTD dataset for a Monthly report ("the report
  // generates using the full MTD data only, no separate weekly period" —
  // see ReportType's doc comment). mtdRows itself is untouched either way:
  // the MTD chart slide and Combined Total table's MTD row always use it
  // directly, regardless of reportType.
  const primaryRows: AggRow[] = isMonthlyReport ? mtdRows : weeklyRows;
  const isPaused = primaryRows.length === 0;
  // Same weekly-vs-MTD choice as primaryRows, but the pre-aggregation raw
  // rows (still carrying _raw) — dynamic-metrics.ts's only way to read a
  // dictionary metric's original CSV column, since aggregateRows drops
  // _raw. Grouped below (campaignRawGroups/adSetRawGroups) the same way
  // campaignGroups/individual AggRow rows already are for the fixed metrics.
  const primaryRawRows: NreRow[] = isMonthlyReport ? (split?.mtdRawRows ?? []) : (split?.weeklyRawRows ?? []);

  // Whether the CSV actually has delivery-status data anywhere at all — a
  // file without that column (the common case) falls back to the original
  // spend-based "active" heuristic instead of every campaign coming back as
  // inactive just because the status column doesn't exist.
  const hasDeliveryStatusData = filteredMtdDailyRows.some((r) => (r.delivery_status || "").trim() !== "");

  // Global reporting date range across ALL campaigns — used on every slide
  // so reporting periods stay consistent even if one campaign started
  // mid-window. Despite the "week" naming (unchanged so this isn't a
  // sweeping rename), this is really "primaryRows' own date range" — the
  // trailing-7-day window normally, or the full MTD span for Monthly.
  let globalWeekStart = "";
  let globalWeekEnd = "";
  primaryRows.forEach((r) => {
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
    const { score, badge } = calculateAccountHealth(primaryRows, isMonthlyReport ? "Monthly" : "Weekly");
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
  let periodRow = computeTableRow(filteredPeriodRows as MetricRow[], currencySymbol, false);
  const mtdRow = computeTableRow(mtdRows, currencySymbol, true);

  // sameMonthAsCurrentMTD: both rows have real data AND land in the same
  // calendar month (e.g. a report generated on the 1st, before the new
  // month's MTD Daily CSV has any real data of its own yet) — a pure data
  // fact, computed here since only this function has both rows in scope to
  // compare. What to DO about it (hide the MTD row entirely, rather than
  // show two near-identical rows) is a rendering decision left to
  // fill-tags.ts's buildTableSlideXml, including whether reportType
  // matters there — not decided here.
  //
  // The explicit `!== null` guard matters: hasData false leaves monthName
  // null on BOTH rows in the no-data case, and null === null would
  // otherwise wrongly read as "same month".
  const sameMonth =
    periodRow.hasData && mtdRow.hasData && periodRow.monthName !== null && periodRow.monthName === mtdRow.monthName;
  periodRow = { ...periodRow, sameMonthAsCurrentMTD: sameMonth };

  // Table header labels: fillMTDRow_ always runs after fillPeriodSlide_ in the
  // source and both write the same header cells, so MTD's own objectives win
  // whenever MTD has data; only fall back to the period row's when MTD is
  // empty. When BOTH rows have real data, though, their objective mixes can
  // genuinely differ (e.g. Period ran an objective MTD no longer does) — Fix
  // 1 unions both rows' labels rather than picking one exclusively, so an
  // objective present in either row always gets a column, never dropped.
  const headerSource = mtdRow.hasData ? mtdRow : periodRow;
  const otherSource = headerSource === mtdRow ? periodRow : mtdRow;
  const seenLabels = new Set<string>();
  const resultColumnHeaders: { label: string; costLabel: string }[] = [];
  for (const row of otherSource.hasData ? [headerSource, otherSource] : [headerSource]) {
    for (const col of row.resultColumns) {
      if (seenLabels.has(col.label)) continue;
      seenLabels.add(col.label);
      resultColumnHeaders.push({ label: col.label, costLabel: col.costLabel });
    }
  }
  const tableHeaderLabels: TableHeaderLabels = { resultColumns: resultColumnHeaders };

  // ── Paused case: single message slide, no campaign/ad-set/chart slides ──
  if (isPaused) {
    const pausedMessage =
      "Campaigns for " + accountName + " were paused during the selected reporting " +
      "period and did not generate impressions, spend, or results. " +
      "No action has been taken on the account during this period.";

    return {
      isPaused: true,
      platform: "META",
      reportType,
      cover,
      campaignSlides: [],
      adSetSlides: [],
      pausedMessage,
      chart: null,
      periodRow,
      mtdRow,
      tableHeaderLabels,
      fileDateRange,
      objectiveWarnings: [],
    };
  }

  // ── Campaign grouping ─────────────────────────────────────────────────
  // primaryRows is sorted by campaign_name (localeCompare) — this governs
  // ad-set slide append order (Phase A2) and which rows land in which group.
  const sortedWeeklyRows = [...primaryRows].sort((a, b) =>
    String(a.campaign_name || "").localeCompare(String(b.campaign_name || "")),
  );

  const campaignGroups: Record<string, AggRow[]> = {};
  sortedWeeklyRows.forEach((row) => {
    const name = String(row.campaign_name || "Unknown Campaign").trim();
    if (!campaignGroups[name]) campaignGroups[name] = [];
    campaignGroups[name].push(row);
  });

  // Raw-row counterparts of campaignGroups (by campaign) and a second
  // grouping by campaign+ad-set — feeds slot-assignment.ts's buildMetaSlots
  // for the extra per-objective dictionary lookups (link clicks, landing
  // page views, etc.) that go beyond the core spend/reach/impressions/ctr/
  // results/cost-per-result fields already computed above.
  const campaignRawGroups: Record<string, NreRow[]> = {};
  const adSetRawGroups: Record<string, NreRow[]> = {};
  primaryRawRows.forEach((row) => {
    const name = String(row.campaign_name || "Unknown Campaign").trim();
    (campaignRawGroups[name] ??= []).push(row);
    const key = adSetKey(name, String(row.ad_set_name || "").trim());
    (adSetRawGroups[key] ??= []).push(row);
  });

  // Ad-set MTD spend, keyed by campaign+ad-set — an individual ad set slide
  // is only worth generating if the ad set's TOTAL MTD spend clears the
  // threshold below, not just its spend within the (possibly much smaller)
  // weekly window.
  const mtdAdSetSpend: Record<string, number> = {};
  mtdRows.forEach((row) => {
    const name = String(row.campaign_name || "Unknown Campaign").trim();
    const key = adSetKey(name, String(row.ad_set_name || "").trim());
    mtdAdSetSpend[key] = (mtdAdSetSpend[key] || 0) + parseCellNum(row.spend);
  });

  // Campaign SUMMARY slide order uses plain default sort (not localeCompare) —
  // matches Object.keys(campaignGroups).sort() in the source exactly. A
  // campaign with zero total spend in the selected weekly window gets no
  // slide at all — even if it has rows in the window (all $0) or has real
  // MTD data from earlier in the month — though it can still show up in the
  // Combined Total table's MTD row, which sums mtdRows independently of this.
  const campaignNames = Object.keys(campaignGroups)
    .filter((name) => campaignGroups[name].reduce((sum, r) => sum + parseCellNum(r.spend), 0) > 0)
    .sort();
  // Ad-set slides (Phase A2 below) skip rows for any campaign excluded above.
  const keptCampaignNames = new Set(campaignNames);

  // ── Phase A1: campaign summary slides ────────────────────────────────
  // Collected alongside the slides below — see ObjectiveWarning's doc
  // comment for what "low confidence" means and why it's surfaced here.
  const objectiveWarnings: ObjectiveWarning[] = [];

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
    if (campRows.some((r) => !r.objectiveConfident)) {
      objectiveWarnings.push({ campaignName, detectedLabel: resultLabel });
    }

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

    const statusIndicator = hasDeliveryStatusData
      ? campaignStatusIndicator(campRows.map((r) => r.delivery_status))
      : null;

    const metrics: SlideMetrics = {
      spend: fmtCurrency(totalSpend, currencySymbol),
      reach: fmtNumber(totalReach),
      impressions: fmtNumber(totalImpr),
      results: resultValue,
      ctr: avgCtr > 0 ? fmtPercent(avgCtr) : "—",
      cpr: cprValue,
      cpc: avgCpc > 0 ? fmtCurrency2dp(avgCpc, currencySymbol) : "—",
    };

    // The campaign template's 7 fixed card slots, automatically assigned by
    // objective — see slot-assignment.ts's buildMetaSlots.
    const dynamicMetrics: DynamicMetricValue[] = buildMetaSlots(
      { resultLabel, costLabel, spend: metrics.spend, reach: metrics.reach, impressions: metrics.impressions, ctr: metrics.ctr, resultValue, cprValue },
      campaignRawGroups[campaignName] ?? [],
      currencySymbol,
    );

    return {
      kind: "campaign" as const,
      campaignName,
      resultLabel,
      costLabel,
      metrics,
      dateRangeLine: globalWeekDateRange + freqLine(avgFreq),
      avgFreq,
      statusIndicator,
      dynamicMetrics,
      ai: {
        ctx: campaignName + " (combined " + campRows.length + " ad sets)",
        dateRange: globalWeekDateRange,
        spend: metrics.spend,
        reach: metrics.reach,
        impressions: metrics.impressions,
        results: fmtNumber(totalResults),
        cpr: metrics.cpr, // see file header: reuses the correctly-computed display value
        ctr: metrics.ctr,
        cpc: metrics.cpc,
        resultLabel,
        costLabel,
        freq: avgFreq,
        resultsNum: totalResults,
        hasResults: totalResults > 0,
        spendNum: totalSpend,
      },
    };
  });

  // An ad set below this total-MTD-spend threshold isn't worth its own
  // slide — still rolled into the campaign summary's totals above, just not
  // broken out individually. A flat threshold in the account's own
  // currency (no FX conversion table anywhere in this app — currency here
  // is a display symbol only), matching the "$1 or equivalent" spec as
  // literally as this codebase's single-currency-per-account model allows.
  const MIN_ADSET_MTD_SPEND_FOR_SLIDE = 1;

  // ── Phase A2: individual ad set slides (only campaigns with 2+ ad sets) ─
  const adSetSlides: AdSetSlideData[] = [];
  sortedWeeklyRows.forEach((row) => {
    const campaignName = String(row.campaign_name || "Campaign").trim();
    const adSetName = String(row.ad_set_name || "").trim();
    if (!keptCampaignNames.has(campaignName)) return; // zero weekly spend — no campaign slide, so no ad-set slides either
    const campAdSetCount = campaignGroups[campaignName]?.length || 0;
    if (campAdSetCount <= 1) return; // single ad set — campaign slide already covers it

    // Archived ad sets never get their own slide regardless of spend — a
    // more final state than merely paused/inactive, which still can.
    if (isArchivedDeliveryStatus(row.delivery_status)) return;
    // Total MTD spend (not just this row's weekly spend) below threshold —
    // too small to warrant breaking out on its own slide.
    const mtdSpend = mtdAdSetSpend[adSetKey(campaignName, adSetName)] || 0;
    if (mtdSpend < MIN_ADSET_MTD_SPEND_FOR_SLIDE) return;

    const { resultLabel, costLabel, resultValue, cprValue } = getSingleRowResultDisplay(row, currencySymbol);
    const rowFreq = rowFrequency(row);
    const statusIndicator = hasDeliveryStatusData ? deliveryStatusIndicator(row.delivery_status) : null;

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

    const dynamicMetrics: DynamicMetricValue[] = buildMetaSlots(
      { resultLabel, costLabel, spend: metrics.spend, reach: metrics.reach, impressions: metrics.impressions, ctr: metrics.ctr, resultValue, cprValue },
      adSetRawGroups[adSetKey(campaignName, adSetName)] ?? [],
      currencySymbol,
    );

    adSetSlides.push({
      kind: "adset",
      campaignName,
      adSetName,
      resultLabel,
      costLabel,
      metrics,
      dateRangeLine: globalWeekDateRange + freqLine(rowFreq),
      rowFreq,
      statusIndicator,
      dynamicMetrics,
      ai: {
        ctx: campaignName + (adSetName ? " / " + adSetName : ""),
        dateRange: globalWeekDateRange,
        spend: fmtCurrency(row.spend, currencySymbol),
        reach: fmtNumber(row.reach),
        impressions: fmtNumber(row.impressions),
        results: fmtNumber(row.results),
        cpr: fmtCurrency2dp(row.cpr, currencySymbol),
        ctr: fmtPercent(row.ctr),
        cpc: fmtCurrency2dp(row.cpc, currencySymbol),
        resultLabel,
        costLabel,
        freq: rowFreq,
        resultsNum: parseCellNum(row.results),
        hasResults: parseCellNum(row.results) > 0,
        spendNum: rowSpend,
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

    const isActive = hasDeliveryStatusData
      ? rows.some((r) => isActiveDeliveryStatus(r.delivery_status))
      : spend > 0;
    const statusIndicator = hasDeliveryStatusData
      ? campaignStatusIndicator(rows.map((r) => r.delivery_status))
      : null;

    return { name, spend, results, cpr, avgCtr, resLabel, cprLabel, isActive, statusIndicator };
  });

  // The chart is always MTD data (see the "MTD performance chart slide"
  // comment above) — its sub-line must reflect the MTD period even for
  // Weekly reports, not the trailing-7-day weekly window used elsewhere on
  // those slides. mtdRow.monthLabel is already "August 1 - August 2, 2026
  // MTD" (computeTableRow above); stripping the " MTD" suffix gives exactly
  // the "[Month] 1 - [Yesterday], [Year]" sub-line the chart needs, reusing
  // the same date range already computed for the Combined Total table's MTD
  // row rather than recomputing it here.
  const periodYear = parseDate(globalWeekEnd || globalWeekStart)?.year;
  const periodSubLabel =
    reportType === "MONTHLY"
      ? mtdRow.monthName && periodYear
        ? `Full Month — ${mtdRow.monthName} ${periodYear}`
        : ""
      : mtdRow.hasData
        ? mtdRow.monthLabel.replace(/ MTD$/, "")
        : "";

  const chart: ChartSlideData = {
    periodLabel: "MTD",
    campaigns: chartCampaigns,
    totalAllSpend,
    activeCampaignCount: chartCampaigns.filter((d) => d.isActive).length,
    reportType,
    mtdMonthName: mtdRow.monthName,
    periodSubLabel,
  };

  return {
    isPaused: false,
    platform: "META",
    reportType,
    cover,
    campaignSlides,
    adSetSlides,
    pausedMessage: null,
    chart,
    periodRow,
    mtdRow,
    tableHeaderLabels,
    fileDateRange,
    objectiveWarnings,
  };
}
