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
import { splitMtdDaily, aggregateRows } from "./aggregate";
import { adSetKey } from "./ad-sets";
import { filterRowsByCampaigns } from "./campaigns";
import { getRowDate, type NreRow } from "./columns";
import type { DateRangeIso } from "./date-range";
import {
  campaignStatusIndicator,
  deliveryStatusIndicator,
  isActiveDeliveryStatus,
  isArchivedDeliveryStatus,
  type DeliveryStatusIndicator,
} from "./delivery-status";
import { getDateRangeShortLabel, getComparisonPeriodLabel, formatDateUS, getMonthName, parseDate } from "./dates";
import { fmtCurrency, fmtCurrency2dp, fmtNumber, fmtPercent, parseCellNum } from "./format";
import { calculateAccountHealth, budgetSummaryLine, budgetPctUsed } from "./health";
import {
  buildCampaignObjectiveMap,
  getGroupedResultDisplayForObjective,
  getSingleRowResultDisplayForObjective,
  groupResultsByCampaignObjective,
  shouldAttributeSpendForObjective,
  normalizeCampaignName,
  resultValueForObjective,
  type ResultLabels,
} from "./objective";
import type { MetricRow } from "./types";
import type { DynamicMetricValue } from "./dynamic-metrics";
import {
  buildMetaSlots,
  buildSlotsFromSelection,
  filterMetricsForCampaignObjective,
  objectiveKeyFor,
  stripNeverKeys,
  type CampaignObjectiveRef,
  type MetaSlotBaseline,
} from "./slot-assignment";
import { listAvailableMetrics, objectiveMetricKeys, splitMetricsForSlides, type AvailableMetric, type SelectedMetric } from "./available-metrics";
import { findMetaMetricByKey } from "./meta-dictionary";
import { detectAdNameColumn } from "./ad-level";
import { buildCreativeReportSections, filterRawRowsToRange, type CreativeReportSections } from "./creative-report-data";
import { computeCreativeRangeIso, computeEffectiveYesterday, toIsoDate } from "./date-range";

/** Rebuild the campaign's 8 (or N) chips in the order the wizard posted, not account-union order. */
function metricsInOverrideOrder(override: string[], selected: SelectedMetric[]): SelectedMetric[] {
  return override
    .map((key) => {
      const fromSelection = selected.find((m) => m.key === key);
      if (fromSelection) return fromSelection;
      const entry = findMetaMetricByKey(key);
      if (!entry?.label || !entry.format) return undefined;
      return {
        key: entry.key,
        label: entry.label,
        format: entry.format,
        csvName: entry.csvName,
        perUnitOf: entry.perUnitOf,
        perUnitScale: entry.perUnitScale,
      } satisfies SelectedMetric;
    })
    .filter((m): m is SelectedMetric => !!m);
}

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
  /** Cost per 1,000 impressions (spend / impressions * 1000), formatted with the account's currency symbol — "—" when impressions are 0. Used by prompts.ts's Reach/Awareness-specific summary prompt and fallback templates (a Reach campaign's own costLabel is already "COST PER 1K REACH", a different metric from CPM). */
  cpm: string;
  resultLabel: string;
  costLabel: string;
  freq: number;
  resultsNum: number;
  hasResults: boolean;
  /** Raw spend for this slide (same value `spend` formats for display) — drives generate-insights.ts's zero-spend/paused-campaign check, which needs a number, not a currency-formatted string. */
  spendNum: number;
  /** True when the CSV's own delivery_status column reports this campaign/ad set as Paused/Inactive (see delivery-status.ts) — independent of spendNum, which can still be nonzero for a campaign paused partway through the week. Always false for Google Ads (no delivery-status detection there). Drives generate-insights.ts's Fix 4 paused-vs-active zero-results templates. */
  isInactive: boolean;
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
   * The campaign template's 8 fixed card slots — automatically assigned by
   * the engine (slot-assignment.ts's buildMetaSlots) when the wizard's
   * Metric Review step is skipped, or built from the wizard's own
   * `selectedMetrics` (BuildReportDataInput) when it isn't. Always exactly
   * 8 entries, in physical slot order 1-8; see pptx/fill-tags.ts's
   * buildCampaignOrAdSetSlideXml, which maps each entry straight onto the
   * template's corresponding card position.
   */
  dynamicMetrics: (DynamicMetricValue | null)[];
  /**
   * Part 4 — present only when this campaign's selected chips exceeded 8;
   * the remaining selected metrics (never padded with unselected extras),
   * rendered as a second "[Name] — Additional Metrics (continued from
   * previous slide)" slide immediately after the main one.
   */
  additionalMetricsSlide?: (DynamicMetricValue | null)[];
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
  dynamicMetrics: (DynamicMetricValue | null)[];
  /** See CampaignSlideData.additionalMetricsSlide. */
  additionalMetricsSlide?: (DynamicMetricValue | null)[];
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

/** Account-level KPI row on the combined MTD overview slide (Option A). All values are MTD-only. */
export interface ChartSnapshotKpis {
  mtdSpendFormatted: string;
  primaryResultsValue: string;
  primaryResultsLabel: string;
  primaryCprValue: string;
  primaryCprLabel: string;
  /** e.g. "19%" — empty when the client has no monthly budget set. */
  budgetPctUsed: string;
  activeCampaignCount: number;
}

export interface ChartSlideData {
  periodLabel: "MTD" | "Weekly";
  campaigns: ChartCampaignData[];
  totalAllSpend: number;
  activeCampaignCount: number;
  /** Option A account snapshot tiles — always MTD, never weekly or previous-month figures. */
  snapshot: ChartSnapshotKpis;
  /** Drives the chart slide's title — see mtdMonthName. */
  reportType: ReportType;
  /** Calendar month name of the MTD data (e.g. "July"), from mtdRow.monthName. Whenever available, the chart title reads "[mtdMonthName] Campaign Performance" instead of the all-caps "MTD/WEEKLY CAMPAIGN PERFORMANCE" fallback — "MTD" is jargon clients don't recognize, and the actual month name reads clearly regardless of report type. */
  mtdMonthName: string | null;
  /**
   * The date-range component combined into the chart title's single line
   * (see chart-slide.ts's buildChartSlideXml, "[Month] Campaign Performance:
   * [periodSubLabel]") — the literal date span for a Weekly report ("July 27
   * - August 2, 2026"), or "Full Month [Year]" for a Monthly report. Empty
   * string when there's no usable date data (e.g. a paused/zero-data
   * report) — the chart slide's title then falls back to just the bare
   * "[Month] Campaign Performance" (or the all-caps MTD/WEEKLY fallback)
   * with no ": ..." suffix at all.
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
  /** Same date range as monthLabel, but never compacted to the same-month short form — always "Month D - Month D" (e.g. "August 1 - August 5"), even when both ends share a month. Used only by the MTD chart slide's own sub-line (buildReportData's periodSubLabel), which has its own year-appended format independent of the Combined Total table's own row-label styling. */
  fullMonthLabel: string;
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
export type ReportType = "WEEKLY" | "MONTHLY" | "DAILY" | "CREATIVE";

/** Which ad platform this report's data came from — drives template selection and a handful of label/prompt differences in the render and AI layers. Defaults to "META" everywhere in this file; only google-report-data.ts's buildGoogleReportData ever produces "GOOGLE". */
export type Platform = "META" | "GOOGLE";

export interface ReportData {
  isPaused: boolean;
  platform: Platform;
  reportType: ReportType;
  cover: CoverData;
  campaignSlides: CampaignSlideData[];
  adSetSlides: AdSetSlideData[];
  /** Ad-level creative slides — populated when CSV includes Ad Name column. */
  creative?: CreativeReportSections | null;
  /** When true, render only cover + creative slides + legend (Creative Report tab). */
  creativeOnly?: boolean;
  pausedMessage: string | null;
  chart: ChartSlideData | null;
  periodRow: TableRowData;
  mtdRow: TableRowData;
  tableHeaderLabels: TableHeaderLabels;
  /** One-line Previous-month vs this-period read for the Combined Total slide / share page. */
  combinedTotalStory?: string;
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
   * selection. Unlike selectedCampaigns, this is applied ONLY to which
   * individual ad-set slides get generated (Phase A2 below) — it never
   * filters mtdDailyRows itself, so it can't touch weeklyRows/mtdRows, the
   * MTD chart, the Combined Total table, or campaign-slide totals. An
   * earlier version of this filter ran before splitMtdDaily and was removed
   * from the wizard because it silently shrank MTD totals below the real
   * account spend, misleading clients — this scoped version can't repeat
   * that. `undefined`/`null` means no selection was made — every ad set
   * (that would otherwise get a slide) keeps its slide.
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
  /** Ad name CSV header — when set, creative slides are built from primary raw rows. */
  adNameColumn?: string | null;
  /** Creative Performance Report — skips campaign/ad-set/chart/table slides. */
  creativeOnly?: boolean;
  now?: Date;
  /**
   * Part 3 — the wizard's optional Metric Review step output. Applies the
   * SAME metric selection uniformly to every campaign/ad-set slide in the
   * report (per-campaign customization is a Phase 2 "Coming soon" in the
   * wizard). `undefined`/empty means the step was skipped or left
   * untouched — every slide keeps the automatic per-objective 8-slot
   * assignment (slot-assignment.ts's buildMetaSlots), exactly as before
   * this field existed.
   */
  selectedMetrics?: SelectedMetric[];
  /**
   * Objective Confirmation wizard step's output — user-reviewed/corrected
   * objectives, keyed by normalized campaign name (see objective.ts's
   * normalizeCampaignName). Engine-detected objectives (via
   * buildCampaignObjectiveMap's resolveCampaignObjective, itself now backed
   * by result-type-map.ts as its first priority) are always computed first;
   * any campaign present here OVERRIDES that engine result before campaign
   * slides, ad-set slides, or the Combined Total table ever read from
   * campaignObjectiveMap — so a user correction is guaranteed to reach
   * every one of those consumers uniformly, since they all already read
   * from that single map (see Step 0 below). `undefined`/empty means the
   * step was skipped or left untouched — every campaign keeps its
   * engine-detected objective, exactly as before this field existed.
   */
  campaignObjectives?: Record<string, ResultLabels>;
  /**
   * Objective Confirmation memory cache (see objective-cache.ts) — every
   * campaign this client has ever confirmed on a PRIOR report's Objective
   * Confirmation step, keyed by normalized campaign name. Consulted ONLY
   * for a campaign's Previous Month row, and only as a fallback for a
   * campaign present in Previous Month Data but ABSENT from the current
   * month's CSV (so campaignObjectives/campaignObjectiveMap above has no
   * entry for it at all) — a campaign the CURRENT report can already
   * resolve keeps that fresher answer; see previousMonthObjectiveMap's own
   * merge logic below for the exact priority order. `undefined`/empty means
   * no campaign has ever been confirmed for this client (or the cache was
   * reset) — every Previous-Month-only campaign keeps its own
   * independently-resolved objective, exactly as before this cache existed.
   */
  objectiveCache?: Record<string, ResultLabels>;
  /**
   * Step 4's optional Per Campaign Customisation — a user has explicitly
   * removed one or more cards from a SPECIFIC campaign's own slide (never
   * shown/editable per-ad-set; an ad-set slide always inherits its PARENT
   * campaign's own override, same "Step 0 single source of truth" rule
   * campaignObjectives already follows). Keyed by normalized campaign name
   * (objective.ts's normalizeCampaignName), each value is the FINAL list of
   * metric keys (from `selectedMetrics`) to show on that campaign's slide —
   * a hard override that replaces the automatic
   * filterMetricsForCampaignObjective narrowing entirely for that campaign,
   * not an additional filter layered on top of it, so a user's explicit
   * per-campaign choice is never silently re-narrowed by the objective
   * logic. A campaign absent from this map keeps the automatic per-objective
   * filtering, exactly as before this field existed. `undefined`/empty
   * means the section was never opened — every campaign behaves exactly as
   * before this field existed. Meta only, matching campaignObjectives'/
   * selectedMetrics' own scope — Google's simpler, single-objective
   * pipeline (google-report-data.ts) has no per-campaign concept to
   * override.
   */
  campaignMetricOverrides?: Record<string, string[]>;
}

// ─────────────────────────── Helpers ───────────────────────────────────────

function average(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

/**
 * A single row's own CTR/CPC columns are Meta-computed percentages/currency
 * amounts, not raw click counts — MetricRow never carries a raw "clicks"
 * field. To recalculate a combined CTR/CPC across many rows from real
 * totals (rather than summing/averaging percentages, which isn't
 * meaningful), each row's own click count is backed out from whichever of
 * its CTR or CPC columns is actually populated: CTR × impressions (Meta's
 * own CTR formula, so this recovers the exact click count) preferred, spend
 * ÷ CPC as a fallback when a row has CPC but no CTR.
 */
function impliedClicks(row: MetricRow, spend: number, impressions: number): number {
  const ctr = parseCellNum(row.ctr);
  if (impressions > 0 && ctr > 0) return (ctr / 100) * impressions;
  const cpc = parseCellNum(row.cpc);
  if (cpc > 0 && spend > 0) return spend / cpc;
  return 0;
}

function rowFrequency(row: MetricRow): number {
  const explicit = parseCellNum(row.frequency);
  if (explicit > 0) return explicit;
  const reach = parseCellNum(row.reach);
  return reach > 0 ? parseCellNum(row.impressions) / reach : 0;
}

/** Cost per 1,000 impressions (spend / impressions × 1000) — feeds AiContext.cpm, the Reach/Awareness-specific summary prompt's own primary cost metric (distinct from a Reach campaign's costLabel, "COST PER 1K REACH", which divides by reach instead). Exported for google-report-data.ts's own AiContext construction (Google Ads has no Reach objective, but AiContext.cpm is a required field on the shared type either way). */
export function fmtCpm(spend: number, impressions: number, currencySymbol: string): string {
  return impressions > 0 ? fmtCurrency2dp((spend / impressions) * 1000, currencySymbol) : "—";
}

/** Exported for share-report.ts, which needs the same "Ad Frequency: X.Xx avg [⚠️ High]" text (minus the leading "\n") for the public share page's campaign/ad-set date-range line. */
export function freqLine(freq: number): string {
  if (freq <= 0) return "";
  return "\nAd Frequency: " + freq.toFixed(1) + "x avg" + (freq > 3.5 ? " ⚠️ High" : "");
}

/** Fix 3 (round 4)/Fix 2 (round 5) — "July 1 - 31" for a same-month, multi-day range (the end day alone, not a second "July"); "July 15" for a single day. Falls back to getDateRangeShortLabel's own "Month D - Month D" form when the range crosses a calendar month boundary (e.g. "July 30 - August 5"). Exported for google-report-data.ts's own Combined Total table row, which needs the exact same short-format logic. */
export function compactSameMonthRangeLabel(rawStart: string, rawEnd: string, monthName: string | null): string {
  const s = parseDate(rawStart);
  const e = parseDate(rawEnd);
  if (!s || !monthName) return "Previous Month";
  if (!e || (s.day === e.day && s.month === e.month && s.year === e.year)) return `${monthName} ${s.day}`;
  if (s.month === e.month && s.year === e.year) return `${monthName} ${s.day} - ${e.day}`;
  return getDateRangeShortLabel(rawStart, rawEnd);
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
 * confusing. Only Reach gets this treatment; CTR/CPC are neither summed nor
 * simply averaged (see impliedClicks below) — they're recalculated from
 * this row set's combined totals instead, since a plain average would give
 * a low-volume row's rate equal weight to a high-volume row's.
 */
function computeTableRow(
  rows: MetricRow[],
  currencySymbol: string,
  isMtdRow: boolean,
  objectiveMap: Map<string, ResultLabels>,
  now: Date = new Date(),
): TableRowData {
  if (!rows || rows.length === 0) {
    // Fix 5 — a zero-spend current month (no MTD Daily CSV rows fell within
    // this calendar month at all — the common case for a campaign that ran
    // last month and simply hasn't delivered since) must never look like
    // the MTD row is missing: the row still needs to show the REAL current
    // month date range, not the bare "—" placeholder below. The Previous
    // Month row (isMtdRow false) has no such requirement — an empty
    // Previous Month Data upload has no "current period" of its own to
    // synthesize, so it keeps the plain placeholder.
    if (isMtdRow) {
      const todayStartTs = new Date(now.toISOString().split("T")[0] + "T00:00:00Z").getTime();
      const yesterdayIso = new Date(todayStartTs - 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const monthStartIso = yesterdayIso.slice(0, 7) + "-01";
      const currentMonthName = getMonthName(monthStartIso);
      return {
        hasData: false,
        monthLabel: compactSameMonthRangeLabel(monthStartIso, yesterdayIso, currentMonthName),
        fullMonthLabel: getDateRangeShortLabel(monthStartIso, yesterdayIso),
        monthName: currentMonthName,
        sameMonthAsCurrentMTD: false,
        spend: "—",
        reach: "—",
        impressions: "—",
        ctr: "—",
        cpc: "—",
        resultColumns: [{ label: "RESULTS", costLabel: "COST PER RESULT", value: "0", cprValue: "—" }],
      };
    }
    return {
      hasData: false,
      monthLabel: "—",
      fullMonthLabel: "—",
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
  let totalClicks = 0;
  let rawStart = "";
  let rawEnd = "";

  rows.forEach((row) => {
    const spend = parseCellNum(row.spend);
    const impr = parseCellNum(row.impressions);
    totalSpend += spend;
    totalReach += parseCellNum(row.reach);
    totalImpr += impr;
    totalClicks += impliedClicks(row, spend, impr);
    if (row.date_start && (!rawStart || row.date_start < rawStart)) rawStart = row.date_start;
    if (row.date_end && (!rawEnd || row.date_end > rawEnd)) rawEnd = row.date_end;
  });

  // CTR/CPC can't be summed OR simply averaged across rows — a low-volume
  // row's CTR/CPC would count exactly as much as a high-volume row's, which
  // skews the combined figure away from the true blended rate whenever rows
  // span multiple campaigns/ad sets with different volumes (the reported
  // bug). Both are instead recalculated from combined totals, the same way
  // Meta computes them in the first place: CTR (All) = total clicks / total
  // impressions × 100, CPC (All) = total spend / total clicks.
  const combinedCtr = totalImpr > 0 ? (totalClicks / totalImpr) * 100 : 0;
  const combinedCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;

  // Every distinct objective actually DETECTED AT THE CAMPAIGN LEVEL becomes
  // its own column pair — kept if it has real spend OR a real result (an
  // objective with truly neither never occurred in this row set and earns no
  // column).
  //
  // Campaign-level, not column-level (permanent architectural fix — see
  // report-data.ts's own Step 0 and objective.ts's buildCampaignObjectiveMap
  // doc comment): groupResultsByCampaignObjective assigns each CAMPAIGN
  // exactly one objective, read from the SAME objectiveMap campaign/ad-set
  // slides use — never re-detected here — and rolls that campaign's entire
  // spend/results into that single bucket. Grouping by each ROW's own
  // resolveObjective result instead (the old getResultGroups(rows) call
  // here) let a secondary/minority signal inside one campaign (e.g. one ad
  // set read as an intermediate "landing_page_view" inside an otherwise
  // Website-Leads campaign) spawn its own phantom column, even though no
  // campaign was actually built around that objective.
  //
  // Per-objective spend tracking (reverses the earlier "reconcile with Ad
  // Spend" fix): a multi-objective account's cost-per-X must divide ONLY
  // that objective's OWN campaigns' spend, never the combined spend across
  // every objective — otherwise a Reach campaign's spend inflates a
  // completely unrelated Meta Form Leads campaign's cost-per-lead (and vice
  // versa). groupResultsByCampaignObjective already computes this correctly
  // per objective (avgCpr + totalSpend, both scoped to only that objective's
  // own campaigns); the "Ad Spend" column above is the one place the FULL
  // combined total still belongs — the overall budget view, not any single
  // objective's cost math.
  // Debug logging (reported bug: MTD row showing inflated Purchases counts)
  // — logs every campaign's assigned objective, the per-row value actually
  // summed, and the running total, straight from groupResultsByCampaignObjective
  // itself (see objective.ts's own doc comment on that function/
  // resultValueForObjective for the root cause and fix). Labeled "MTD" vs
  // "Previous Month" so both rows' console output is easy to tell apart.
  const allGroupsRaw = groupResultsByCampaignObjective(rows, objectiveMap, isMtdRow ? "MTD" : "Previous Month");
  // "RESULTS" is getResultLabels' own generic fallback bucket for a blank
  // or unrecognized result_type (not a real, nameable objective) — it must
  // never earn a zero-count-but-spend column the way a genuine objective
  // (Website Leads, Reach, ...) does; a stray untagged row with some spend
  // attached is noise, not an objective a client would recognize.
  const activeGroups = allGroupsRaw.filter((g) => g.count > 0 || (g.totalSpend > 0 && g.label !== "RESULTS"));
  // Every group had literally zero spend and zero results (shouldn't
  // happen with real data) — fall back to the unfiltered list rather than
  // leaving the table with zero result-column pairs, which
  // fillCombinedTotalTable requires at least one of (see table-slide.ts).
  const groupsToShow = activeGroups.length > 0 ? activeGroups : allGroupsRaw;
  // Every distinct reported objective keeps a column pair. The Combined
  // Total table grows past the template's native width rather than dropping
  // a live objective (see table-slide.ts).
  const allGroups = [...groupsToShow].sort((a, b) => b.totalSpend - a.totalSpend);

  const rawMonthLabel = rawStart ? getDateRangeShortLabel(rawStart, rawEnd) : "This Period";
  const monthName = rawStart ? getMonthName(rawStart) : null;

  // Fix 3 — both rows show just the plain date range: no "Previous Month —
  // " prefix, no year, no "MTD" suffix. Fix 2 (this round) — both rows also
  // use the same compact same-month form ("August 1 - 5" — the end day
  // alone, not a second "August"; "July 30 - August 5" unchanged when the
  // range crosses a month boundary) via compactSameMonthRangeLabel, instead
  // of the MTD row previously always repeating the month name.
  const monthLabel = rawStart
    ? compactSameMonthRangeLabel(rawStart, rawEnd, monthName)
    : isMtdRow
      ? "This Period"
      : "Previous Month";

  return {
    hasData: true,
    monthLabel,
    fullMonthLabel: rawMonthLabel,
    monthName,
    // Set false here unconditionally — buildReportData overrides this on
    // the Previous Month row specifically, once both rows exist to compare
    // months against each other (this function only ever sees one row's
    // own data at a time).
    sameMonthAsCurrentMTD: false,
    spend: fmtCurrency(totalSpend, currencySymbol),
    reach: fmtNumber(totalReach),
    impressions: fmtNumber(totalImpr),
    ctr: combinedCtr > 0 ? fmtPercent(combinedCtr) : "—",
    cpc: combinedCpc > 0 ? fmtCurrency2dp(combinedCpc, currencySymbol) : "—",
    resultColumns: allGroups.map((g) => {
      // g.avgCpr is already this objective's own spend divided by its own
      // count (or, for an uncounted Reach objective — real Reach campaigns
      // rarely populate a `results` count — its own spend × 1000 / its own
      // reach) — computed entirely from this objective's own rows by
      // getResultGroups, never the account's combined spend.
      const isUncountedReach = g.label === "REACH" && g.count === 0;
      let cprValue: string;
      if (isUncountedReach) {
        cprValue = g.avgCpr > 0 ? fmtCurrency2dp(g.avgCpr, currencySymbol) : "—";
      } else if (g.count > 0) {
        cprValue = fmtCurrency2dp(g.avgCpr, currencySymbol);
      } else if (g.totalSpend > 0) {
        // Real spend, zero results — the cost is genuinely undefined
        // (dividing by zero), not "$0.00" and not silently hidden. The
        // client should still see that this objective ran and spent money.
        cprValue = "N/A";
      } else {
        cprValue = "—";
      }

      return {
        label: g.label,
        // The real costLabel from getResultLabels() (e.g. "COST PER LEAD",
        // "COST PER SUBSCRIPTION") — the Combined Total table always shows
        // the actual objective's cost label, never an abbreviation.
        costLabel: g.costLabel,
        value: fmtNumber(g.count),
        cprValue,
      };
    }),
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

export function buildCombinedTotalStory(
  periodRow: TableRowData,
  mtdRow: TableRowData,
  headers: TableHeaderLabels,
  reportType: ReportType,
): string {
  const n = headers.resultColumns.length;
  const objWord = n === 1 ? "1 reported objective" : `${n} reported objectives`;
  if (periodRow.hasData && periodRow.sameMonthAsCurrentMTD) {
    return `Previous month ${periodRow.spend} across ${objWord}.`;
  }
  if (periodRow.hasData && mtdRow.hasData && reportType !== "MONTHLY") {
    return `Previous month ${periodRow.spend} vs this period ${mtdRow.spend}, across ${objWord}.`;
  }
  if (mtdRow.hasData) {
    return `This period ${mtdRow.spend} across ${objWord}.`;
  }
  if (periodRow.hasData) {
    return `Previous month ${periodRow.spend} across ${objWord}.`;
  }
  return "";
}

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
    selectedMetrics,
    campaignObjectives,
    objectiveCache,
    campaignMetricOverrides,
    adNameColumn: adNameColumnInput,
    creativeOnly = false,
  } = input;
  const isMonthlyReport = reportType === "MONTHLY";
  const isDailyReport = reportType === "DAILY";
  const isCreativeReport = reportType === "CREATIVE" || creativeOnly;

  const campaignFilteredRows = filterRowsByCampaigns(mtdDailyRows, selectedCampaigns ?? null);
  // selectedAdSets is NOT applied here — see its doc comment on
  // BuildReportDataInput: it only prunes which ad-set slides get built
  // (Phase A2 below), never the rows that feed MTD/weekly totals.
  const filteredMtdDailyRows = campaignFilteredRows;
  // A Monthly report has no weekly window at all — weeklyRange is ignored
  // (never even resolved by the caller in that case) and splitMtdDaily's
  // own weekly split is simply never used below (see primaryRows).
  const split = splitMtdDaily(filteredMtdDailyRows, now, weeklyRange ? { weeklyRange } : {});

  // The optional Previous Month Data (previous full month) feeds the table
  // slide's separate "Period" row. Its campaign selection is independent of
  // the MTD Daily CSV's — it's made against the Previous Month Data upload's
  // own campaign list (Client.previousMonthSelectedCampaigns) and applied by
  // the caller via loadPreviousMonthDataRows() *before* periodRows ever
  // reaches this function. Re-filtering here with the MTD CSV's own
  // selectedCampaigns/selectedAdSets (an unrelated selection, scoped to a
  // different month's data and often a different set of campaigns/ad sets
  // entirely) would silently drop previous-month campaigns that aren't
  // present in — or selectable from — the current month's MTD CSV, e.g. a
  // campaign paused this month that still had spend last month. So
  // periodRows is used as-is here, already filtered exactly once, correctly.
  const filteredPeriodRows = periodRows ?? [];
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
  const primaryRawRows: NreRow[] = isMonthlyReport ? (split?.mtdRawRows ?? []) : (split?.weeklyRawRows ?? []);

  const adNameColumn =
    adNameColumnInput ??
    detectAdNameColumn(primaryRawRows.length > 0 ? Object.keys(primaryRawRows[0]._raw || {}) : []);

  function keptCampaignNamesForCreative(
    rawRows: NreRow[],
    selected: string[] | null | undefined,
  ): Set<string> {
    const names = new Set<string>();
    rawRows.forEach((row) => {
      const c = String(row.campaign_name || "").trim();
      if (c) names.add(c);
    });
    if (selected && selected.length > 0) {
      return new Set(selected.filter((c) => names.has(c)));
    }
    return names;
  }

  function buildCreativeSections(dateLine: string, rawForCreative: NreRow[]): CreativeReportSections | null {
    if (!adNameColumn || rawForCreative.length === 0) return null;
    return buildCreativeReportSections({
      rawRows: rawForCreative,
      adNameColumn,
      currencySymbol,
      dateRangeLine: dateLine,
      keptCampaignNames: keptCampaignNamesForCreative(rawForCreative, selectedCampaigns),
    });
  }

  if (isCreativeReport) {
    const creativeRange = computeCreativeRangeIso(filteredMtdDailyRows, now, 30);
    const creativeRaw = creativeRange
      ? filterRawRowsToRange(
          filterRowsByCampaigns(filteredMtdDailyRows, selectedCampaigns ?? null),
          creativeRange.startIso,
          creativeRange.endIso,
        )
      : [];
    const dateLine = creativeRange
      ? getDateRangeShortLabel(creativeRange.startIso, creativeRange.endIso)
      : "";
    const creative = buildCreativeSections(dateLine, creativeRaw);
    const creativeAgg = aggregateRows(creativeRaw);
    const { score, badge } = calculateAccountHealth(creativeAgg, "Weekly");
    const yesterday = computeEffectiveYesterday(filteredMtdDailyRows, now);
    const coverDate = yesterday ? formatDateUS(toIsoDate(yesterday)) : "";
    const emptyRow = computeTableRow([], currencySymbol, false, new Map());
    return {
      isPaused: !creative || creative.overviewSlides.length === 0,
      platform: "META",
      reportType: "CREATIVE",
      cover: {
        accountName,
        reportDate: coverDate,
        dateRange: dateLine,
        healthBadge: badge,
        healthScore: score,
        budgetSummary: budgetSummaryLine(
          creativeRaw.reduce((s, r) => s + parseCellNum(r.spend), 0),
          monthlyBudget,
          currencySymbol,
        ),
      },
      campaignSlides: [],
      adSetSlides: [],
      creative,
      creativeOnly: true,
      pausedMessage:
        !creative || creative.overviewSlides.length === 0
          ? "No ad-level data found. Upload an Ad-level CSV with an Ad Name column."
          : null,
      chart: null,
      periodRow: emptyRow,
      mtdRow: emptyRow,
      tableHeaderLabels: { resultColumns: [] },
      fileDateRange: dateLine,
      objectiveWarnings: [],
    };
  }

  // Step 0 — single source of truth for campaign objective detection (see
  // objective.ts's buildCampaignObjectiveMap doc comment): permanent fix for
  // campaign slides and the Combined Total table disagreeing on a campaign's
  // objective when each independently re-detected it from a row set that
  // only partially overlapped the other's. Built once here, before any
  // slide or table row is built, and reused by every consumer below —
  // computeTableRow's MTD row, every campaign/ad-set summary slide (Phase
  // A1/A2), and the Combined Total table's column grouping. Built from
  // mtdRows ∪ primaryRows so the map covers every campaign either the table
  // (always MTD-based) or the slides (weekly OR MTD-based, depending on
  // reportType) might ask about, even the rare case where a custom weekly
  // window falls partly outside the current MTD span.
  const campaignObjectiveMap = buildCampaignObjectiveMap([...mtdRows, ...primaryRows]);
  // Objective Confirmation wizard step — a user-reviewed/corrected
  // objective always wins over the engine's own detection, for every
  // consumer that reads campaignObjectiveMap below (campaign slides,
  // ad-set slides via their parent campaign, and the Combined Total
  // table's column grouping all already read from this one map — see the
  // doc comment above). Scoped to THIS month's campaigns only: a campaign
  // absent from campaignObjectives simply keeps its engine-detected
  // objective. See previousMonthObjectiveMap below for how — and how much —
  // this now also reaches a continuing campaign's Previous Month row.
  if (campaignObjectives) {
    for (const [name, objective] of Object.entries(campaignObjectives)) {
      campaignObjectiveMap.set(normalizeCampaignName(name), objective);
    }
  }
  // Step 4's Per Campaign Customisation — see BuildReportDataInput's
  // campaignMetricOverrides doc comment for the hard-replacement semantics.
  // Normalized the same way as campaignObjectiveMap above so lookups inside
  // computeMetaSlideMetrics use the same key convention as every other
  // campaign-name map in this function.
  const campaignMetricOverrideMap = new Map<string, string[]>(
    Object.entries(campaignMetricOverrides ?? {}).map(([name, keys]) => [normalizeCampaignName(name), keys]),
  );
  // A campaign's Previous Month objective is independently resolved from
  // that separate upload's own (different month's) raw rows — unaggregated,
  // same as always; Previous Month Data is one row per campaign/ad-set for
  // the WHOLE month (a real date_start-to-date_end range per row), not
  // per-day like the MTD Daily CSV, so it deliberately never goes through
  // aggregateRows (which assumes one-row-per-day and would collapse that
  // range down to a single day — see getRowDate/aggregate.ts).
  const previousMonthObjectiveMap = buildCampaignObjectiveMap(filteredPeriodRows as MetricRow[]);
  // Part 6 bug fix — a campaign that continued from last month into this
  // one already has a user-reviewed/confirmed objective sitting in
  // campaignObjectiveMap (engine-detected, and wizard-corrected if the user
  // touched the Objective Confirmation step); that confirmation is the
  // single most reliable signal available for this SAME campaign's Previous
  // Month row too, so it wins over independently re-detecting the objective
  // from last month's own (often blanker/staler) result_type data.
  //
  // Objective Confirmation memory cache (Part 4) — a campaign present ONLY
  // in Previous Month Data (paused/renamed since, so campaignObjectiveMap
  // has no entry for it at all) still checks the client's PERSISTED cache
  // next, before falling back to its own independently-resolved objective —
  // a past confirmation from an earlier report is a far more reliable
  // signal than re-detecting from last month's own (often blanker/staler)
  // raw rows. Only reached when there's no current-month entry to prefer.
  for (const name of previousMonthObjectiveMap.keys()) {
    const confirmed = campaignObjectiveMap.get(name);
    if (confirmed) {
      previousMonthObjectiveMap.set(name, confirmed);
      continue;
    }
    const cached = objectiveCache?.[name];
    if (cached) previousMonthObjectiveMap.set(name, cached);
  }

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
    const periodLabel = isMonthlyReport ? "Monthly" : isDailyReport ? "Daily" : "Weekly";
    const { score, badge } = calculateAccountHealth(primaryRows, periodLabel);
    const mtdSpend = mtdRows.reduce((sum, r) => sum + parseCellNum(r.spend), 0);
    const coverCampaignCount = new Set(primaryRows.map((r) => String(r.campaign_name || "").trim()).filter(Boolean)).size;
    const budgetLine = budgetSummaryLine(mtdSpend, monthlyBudget, currencySymbol, now);
    cover = {
      accountName,
      reportDate: reportDateStr,
      dateRange: globalWeekDateRange,
      healthBadge: badge,
      healthScore: score,
      budgetSummary:
        budgetLine ||
        (coverCampaignCount > 0
          ? `${coverCampaignCount} campaign${coverCampaignCount === 1 ? "" : "s"} in this report`
          : ""),
    };
  }

  // ── Period row (row 2) + MTD row (row 3) of the 10-column table ─────────
  // Computed regardless of isPaused: fillPeriodSlide_/fillMTDRow_ in the
  // source run unconditionally after the phase-A slide-building block, so a
  // paused CURRENT month can still show real PREVIOUS month data if a Period
  // CSV was uploaded (mtdRow will naturally come back empty since mtdRows is
  // [] when paused).
  let periodRow = computeTableRow(filteredPeriodRows as MetricRow[], currencySymbol, false, previousMonthObjectiveMap, now);
  const mtdRow = computeTableRow(mtdRows, currencySymbol, true, campaignObjectiveMap, now);

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
  const unionColumnHeaders: { label: string; costLabel: string }[] = [];
  for (const row of otherSource.hasData ? [headerSource, otherSource] : [headerSource]) {
    for (const col of row.resultColumns) {
      if (seenLabels.has(col.label)) continue;
      seenLabels.add(col.label);
      unionColumnHeaders.push({ label: col.label, costLabel: col.costLabel });
    }
  }
  const tableHeaderLabels: TableHeaderLabels = { resultColumns: unionColumnHeaders };
  const combinedTotalStory = buildCombinedTotalStory(periodRow, mtdRow, tableHeaderLabels, reportType);

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
      combinedTotalStory,
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

  // Part 3/4/8 — the wizard's selectedMetrics (if any) is a single
  // account-wide list (for a mixed-objective account, built by
  // buildMultiObjectiveSelection, it's every detected objective's own
  // result/cost pair combined); it is NOT applied as-is to every campaign's
  // slide — each campaign/ad-set only shows its OWN objective's pair (plus
  // the always-relevant base/secondary metrics), via
  // filterMetricsForCampaignObjective below, computed fresh per call since
  // each campaign has its own objective. `availableMetricsPool` (for Part
  // 4's under-4-on-slide-2 padding) is derived from the CSV's own column
  // headers — every row in one upload shares the same columns, so the first
  // row's `_raw` keys stand in for the full header set without needing a
  // separate headers input threaded all the way in.
  const availableMetricsPool: AvailableMetric[] | null =
    selectedMetrics && selectedMetrics.length > 0 ? listAvailableMetrics(Object.keys(primaryRawRows[0]?._raw ?? {}), "META") : null;

  /**
   * One slide's worth of metric cards — the automatic per-objective 8-slot
   * assignment (no wizard input), or the wizard's own selectedMetrics,
   * filtered down to THIS campaign/ad-set's own objective (Part 8) and split
   * into slide(s). `baseline` is reused as-is for the handful of keys
   * report-data.ts already computes (spend/reach/impressions/ctr/results/
   * cost_per_result) — see slot-assignment.ts's buildSlotsFromSelection.
   * `campaignObjective` is this specific slide's own {resultLabel,
   * costLabel} — the ad-set call site passes its PARENT campaign's own
   * objective, matching Step 0's single source of truth (see the ad-set
   * loop's own comment below).
   */
  function computeMetaSlideMetrics(
    baseline: MetaSlotBaseline,
    rawRows: NreRow[],
    campaignObjective: CampaignObjectiveRef | null,
    campaignName: string,
  ): { dynamicMetrics: (DynamicMetricValue | null)[]; additionalMetricsSlide?: (DynamicMetricValue | null)[] } {
    if (!selectedMetrics || selectedMetrics.length === 0 || !availableMetricsPool) {
      return { dynamicMetrics: buildMetaSlots(baseline, rawRows, currencySymbol) };
    }
    const baselineValues: Partial<Record<string, string>> = {
      spend: baseline.spend,
      reach: baseline.reach,
      impressions: baseline.impressions,
      ctr: baseline.ctr,
      results: baseline.resultValue,
      cost_per_result: baseline.cprValue,
    };
    // Part 8 — a mixed-objective selection's own per-campaign pair uses a
    // SYNTHETIC key (e.g. "website_leads"/"cost_per_website_leads", see
    // objectiveMetricKeys/buildMultiObjectiveSelection), not the generic
    // "results"/"cost_per_result" keys above. Without this, buildSlotsFromSelection's
    // baseline lookup would miss on that synthetic key and fall through to
    // re-aggregating raw CSV rows by column name — which can disagree with
    // baseline.resultValue, since that value is already correctly filtered
    // to rows whose own resolved objective matches this campaign's assigned
    // one (getGroupedResultDisplayForObjective/getSingleRowResultDisplayForObjective),
    // while a fresh raw-column sum is not. REACH's own pair (CPM/COST PER 1K
    // REACHED) is a real dictionary metric with its own per-unit aggregation,
    // not a stand-in for results/cost_per_result, so it's deliberately left
    // to resolve via the normal raw-row lookup instead.
    if (campaignObjective) {
      const { resultKey, costKey, dedicated } = objectiveMetricKeys(campaignObjective.resultLabel);
      if (!dedicated) {
        baselineValues[resultKey] = baseline.resultValue;
        baselineValues[costKey] = baseline.cprValue;
      }
      // Bug fix — "cost_per_lead" (meta-dictionary.ts) is a real dedicated
      // CSV column some Meta InstantForms exports use instead of "Cost per
      // on-facebook lead", selected by available-metrics.ts's META FORM
      // LEADS case when the CSV has that exact header. Its own dictionary
      // entry's perUnitOf is "website_leads" (correct for the OTHER
      // objectives — leads/website_leads — this same key is also
      // selectable for), which has no data on a META FORM LEADS campaign's
      // own rows, so aggregateDynamicMetrics' sum(spend)/sum(perUnitOf)
      // always resolves to NaN -> "—" for it here. Cost per result IS cost
      // per lead for this objective (baseline.cprValue is already computed
      // from this campaign's own objective-matched rows, same as costKey
      // above), so alias it the same way — scoped to META FORM LEADS only,
      // never touching a WEBSITE LEADS campaign's own (correct) reading of
      // this key if a user manually adds it there via the Metric Cards
      // "Add from your CSV" pool.
      if (objectiveKeyFor(campaignObjective.resultLabel) === "meta_form_leads") {
        baselineValues["cost_per_lead"] = baseline.cprValue;
      }
    }
    // Step 4 Section B — a user-edited campaign gets its own explicit metric
    // list as a HARD REPLACEMENT of the automatic per-objective narrowing
    // below, not an additional filter on top of it (see
    // BuildReportDataInput.campaignMetricOverrides doc comment). A campaign
    // absent from the map keeps the automatic filterMetricsForCampaignObjective
    // behavior, unchanged from before this override existed.
    const override = campaignMetricOverrideMap.get(normalizeCampaignName(campaignName));
    // Thing 1 (three-layer objective architecture rebuild) — stripNeverKeys
    // is applied AFTER either branch, including the explicit per-campaign
    // override: "no campaign ever shows another objective's primary
    // metrics" holds regardless of what the user selected in Metric
    // Review, so even a deliberate override can never re-introduce a card
    // this campaign's own objective forbids (e.g. a website_leads card on
    // a META FORM LEADS campaign's slide).
    //
    // Override keys are applied IN OVERRIDE ORDER (the chips on screen),
    // not `selectedMetrics.filter` union order. The account-wide union can
    // put cpc_all ahead of link_clicks when another campaign uses CPC (All).
    const relevantMetrics = stripNeverKeys(
      override ? metricsInOverrideOrder(override, selectedMetrics) : filterMetricsForCampaignObjective(selectedMetrics, campaignObjective),
      objectiveKeyFor(campaignObjective?.resultLabel),
    ).filter((m): m is SelectedMetric => m !== null);
    const [slide1Keys, slide2Keys] = splitMetricsForSlides(
      relevantMetrics,
      availableMetricsPool,
      campaignObjective?.resultLabel,
      campaignObjective?.costLabel,
    );
    // Slide 1 is the wizard selection in chip order. Slide 2 is extras;
    // if those extras are 1–3, padSparseContinuationSlide repeats this
    // campaign's result + cost pair from slide 1 so the continuation is
    // never a single lonely card. No invented CSV columns. A selected
    // metric with no real data for THIS campaign keeps its label and
    // shows "—" (buildSlotsFromSelection). fill-tags.ts must still retext
    // that slot so template "CPC (All)" cannot linger.
    const dynamicMetrics = buildSlotsFromSelection(slide1Keys, baselineValues, rawRows, "meta", currencySymbol);
    const additionalMetricsSlide = slide2Keys
      ? buildSlotsFromSelection(slide2Keys, baselineValues, rawRows, "meta", currencySymbol)
      : undefined;
    return { dynamicMetrics, additionalMetricsSlide };
  }

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
    // Step 0's single source of truth — see buildReportData's own Step 0
    // comment and objective.ts's buildCampaignObjectiveMap doc comment.
    // normalizeCampaignName closes the case-sensitivity loophole: the map's
    // own keys are normalized (see buildCampaignObjectiveMap), so a
    // display-cased lookup here must be normalized identically or it would
    // silently miss. Falls back to the generic RESULTS bucket only
    // defensively (every campaign here came from primaryRows, which
    // campaignObjectiveMap was itself built from — this should never
    // actually miss).
    const campaignObjective = campaignObjectiveMap.get(normalizeCampaignName(campaignName)) ?? {
      resultLabel: "RESULTS",
      costLabel: "COST PER RESULT",
    };
    const { resultLabel, costLabel, resultValue, cprValue } = getGroupedResultDisplayForObjective(campRows, campaignObjective, currencySymbol);
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

    // The campaign template's 8 fixed card slots — automatically assigned by
    // objective (slot-assignment.ts's buildMetaSlots), or built from the
    // wizard's own selectedMetrics — see computeMetaSlideMetrics above.
    const { dynamicMetrics, additionalMetricsSlide } = computeMetaSlideMetrics(
      { resultLabel, costLabel, spend: metrics.spend, reach: metrics.reach, impressions: metrics.impressions, ctr: metrics.ctr, resultValue, cprValue },
      campaignRawGroups[campaignName] ?? [],
      campaignObjective,
      campaignName,
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
      additionalMetricsSlide,
      ai: {
        // Fix 3 — no internal grouping detail ("(combined N ad sets)") in
        // what gets sent to the AI: this is bookkeeping about how the
        // report engine rolled up the data, not something a client-facing
        // summary should ever mention.
        ctx: campaignName,
        dateRange: globalWeekDateRange,
        spend: metrics.spend,
        reach: metrics.reach,
        impressions: metrics.impressions,
        // Reuses resultValue/metrics.results — the same objective-aware
        // count slot 4's own card shows (getGroupedResultDisplayForObjective
        // above) — never a separately-summed raw r.results total, which can
        // legitimately disagree with the slide (e.g. it includes rows whose
        // own resolved objective differs from the campaign's assigned one).
        // The reported bug: AI text said "35 purchases" while the slide's
        // own PURCHASES card read 0, because this used to sum raw r.results
        // regardless of objective.
        results: resultValue,
        cpr: metrics.cpr, // see file header: reuses the correctly-computed display value
        ctr: metrics.ctr,
        cpc: metrics.cpc,
        cpm: fmtCpm(totalSpend, totalImpr, currencySymbol),
        resultLabel,
        costLabel,
        freq: avgFreq,
        resultsNum: parseCellNum(resultValue),
        hasResults: parseCellNum(resultValue) > 0,
        spendNum: totalSpend,
        isInactive: statusIndicator !== null,
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

  // ── Phase A2: individual ad set slides ───────────────────────────────────
  // Deselecting an ad set in the wizard only removes ITS OWN slide here —
  // see BuildReportDataInput.selectedAdSets's doc comment for why this
  // can't be allowed to reach mtdDailyRows/weeklyRows/mtdRows.
  //
  // A single-ad-set campaign's slide is opt-in, not automatic: the wizard
  // defaults it to unchecked (its own slide would be identical to the
  // campaign slide), but checking it explicitly requests one anyway — so
  // when a real selection is present, selection alone decides. Only when
  // NO selection info was ever sent (selectedAdSetsSet === null — an older
  // caller, or a test that doesn't pass selectedAdSets at all) does the
  // engine fall back to its own old default of skipping single-ad-set
  // campaigns automatically.
  const selectedAdSetsSet = selectedAdSets != null ? new Set(selectedAdSets) : null;
  const adSetSlides: AdSetSlideData[] = [];
  sortedWeeklyRows.forEach((row) => {
    const campaignName = String(row.campaign_name || "Campaign").trim();
    const adSetName = String(row.ad_set_name || "").trim();
    if (!keptCampaignNames.has(campaignName)) return; // zero weekly spend — no campaign slide, so no ad-set slides either
    if (selectedAdSetsSet) {
      if (!selectedAdSetsSet.has(adSetKey(campaignName, adSetName))) return; // not selected (or deselected)
    } else {
      const campAdSetCount = campaignGroups[campaignName]?.length || 0;
      if (campAdSetCount <= 1) return; // no selection info — single ad set covered by the campaign slide by default
    }

    // Archived ad sets never get their own slide regardless of spend — a
    // more final state than merely paused/inactive, which still can.
    if (isArchivedDeliveryStatus(row.delivery_status)) return;
    // Total MTD spend (not just this row's weekly spend) below threshold —
    // too small to warrant breaking out on its own slide.
    const mtdSpend = mtdAdSetSpend[adSetKey(campaignName, adSetName)] || 0;
    if (mtdSpend < MIN_ADSET_MTD_SPEND_FOR_SLIDE) return;

    // Reads the PARENT campaign's own objective (Step 0's single source of
    // truth), not this ad set's own individually-resolved result_type — so
    // every ad-set slide under one campaign always agrees with that
    // campaign's own summary slide and with the Combined Total table.
    // normalizeCampaignName matches the map's own normalized keys (see
    // buildCampaignObjectiveMap) — same case-sensitivity fix as above.
    const campaignObjective = campaignObjectiveMap.get(normalizeCampaignName(campaignName)) ?? {
      resultLabel: "RESULTS",
      costLabel: "COST PER RESULT",
    };
    const { resultLabel, costLabel, resultValue, cprValue } = getSingleRowResultDisplayForObjective(row, campaignObjective, currencySymbol);
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

    const { dynamicMetrics, additionalMetricsSlide } = computeMetaSlideMetrics(
      { resultLabel, costLabel, spend: metrics.spend, reach: metrics.reach, impressions: metrics.impressions, ctr: metrics.ctr, resultValue, cprValue },
      adSetRawGroups[adSetKey(campaignName, adSetName)] ?? [],
      campaignObjective,
      campaignName,
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
      additionalMetricsSlide,
      ai: {
        ctx: campaignName + (adSetName ? " / " + adSetName : ""),
        dateRange: globalWeekDateRange,
        // Reuses `metrics`/resultValue/cprValue — the exact same slot 1-6
        // values this ad set's own card slots show (getSingleRowResultDisplayForObjective
        // above), never the row's own raw spend/reach/impressions/results/
        // ctr/cpc fields directly, which can disagree when this row's own
        // resolved objective differs from the campaign's assigned one.
        spend: metrics.spend,
        reach: metrics.reach,
        impressions: metrics.impressions,
        results: resultValue,
        cpr: metrics.cpr,
        ctr: metrics.ctr,
        cpc: metrics.cpc,
        cpm: fmtCpm(rowSpend, rowImpr, currencySymbol),
        resultLabel,
        costLabel,
        freq: rowFreq,
        resultsNum: parseCellNum(resultValue),
        hasResults: parseCellNum(resultValue) > 0,
        spendNum: rowSpend,
        isInactive: statusIndicator !== null,
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
  // Fix 6 — a campaign that's part of this report (campaignNames, built
  // from primaryRows above) but contributed zero rows to mtdRows this
  // calendar month must still get its own donut, showing $0/empty rather
  // than silently vanishing from the chart. campaignNames only ever comes
  // from primaryRows (this report's own weekly/MTD scope) — never from
  // Previous Month Data — so unioning it in here can't leak last month's
  // figures onto the chart, only supplies campaign IDENTITY for a $0 month.
  const chartCampaignNames = Array.from(new Set([...Object.keys(chartGroups), ...campaignNames])).sort();

  let totalAllSpend = 0;
  const chartCampaigns: ChartCampaignData[] = chartCampaignNames.map((name) => {
    const rows = chartGroups[name] || [];
    const spend = rows.reduce((s, r) => s + parseCellNum(r.spend), 0);
    const ctrs = rows.map((r) => parseCellNum(r.ctr)).filter((v) => v > 0);
    const avgCtr = average(ctrs);
    // Single source of truth (reported bug: the donut chart showed "ADD TO
    // CART" for a purchase campaign) — this used to be a private port of
    // addVisualScorecardSlide_'s own per-campaign result-type detection,
    // based on the FIRST row's result_type only via getResultLabels'
    // fuzzy-text match — an entirely separate, un-synced detection path
    // from the one campaign/ad-set slides and the Combined Total table
    // already read from (campaignObjectiveMap, Step 0 above), so the chart
    // could disagree with what a campaign's own slide displayed for the
    // exact same campaign. Same normalizeCampaignName lookup, same fallback,
    // as every other campaignObjectiveMap consumer in this function.
    const chartObjective = campaignObjectiveMap.get(normalizeCampaignName(name)) ?? {
      resultLabel: "RESULTS",
      costLabel: "COST PER RESULT",
    };
    const resLabel = chartObjective.resultLabel;
    const cprLabel = chartObjective.costLabel;
    const { count: results, cpr } = comparisonObjectiveTotals(rows, chartObjective);
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
  // those slides. mtdRow.fullMonthLabel is always "August 1 - August 5"
  // (never compacted to the Combined Total table's own "August 1 - 5" short
  // form — see TableRowData's own doc comment) — appending the year here
  // reuses that same date range for the chart's own "[Month] 1 - [Yesterday],
  // [Year]" sub-line without recomputing it.
  // Fix 2 (chart title/date single-line combination): the Monthly branch
  // used to repeat the month name here ("Full Month — August 2026"), which
  // read fine as its own sub-line but duplicates the month name once
  // chart-slide.ts folds this into the title itself ("August Campaign
  // Performance: Full Month — August 2026"). Dropped the repeated month name
  // and the dash so the combined title reads "August Campaign Performance:
  // Full Month 2026" instead.
  // Fix 6 — mtdRow.monthName/fullMonthLabel are now ALWAYS the real current
  // month's range (see Fix 5's computeTableRow change above), never a bare
  // "—" placeholder even when mtdRows is empty — so the sub-line no longer
  // needs to gate on mtdRow.hasData to avoid showing stale/blank text; it
  // always reflects the current month, zero-spend or not.
  const periodYear = parseDate(globalWeekEnd || globalWeekStart)?.year;
  const periodSubLabel =
    reportType === "MONTHLY"
      ? mtdRow.monthName && periodYear
        ? `Full Month ${periodYear}`
        : ""
      : periodYear
        ? `${mtdRow.fullMonthLabel}, ${periodYear}`
        : mtdRow.fullMonthLabel;

  const primaryMtd = mtdRow.resultColumns[0] ?? {
    label: "RESULTS",
    costLabel: "COST PER RESULT",
    value: "0",
    cprValue: "—",
  };
  const pctUsed = budgetPctUsed(totalAllSpend, monthlyBudget);
  const chart: ChartSlideData = {
    periodLabel: "MTD",
    campaigns: chartCampaigns,
    totalAllSpend,
    activeCampaignCount: chartCampaigns.filter((d) => d.isActive).length,
    snapshot: {
      mtdSpendFormatted: fmtCurrency(totalAllSpend, currencySymbol),
      primaryResultsValue: primaryMtd.value,
      primaryResultsLabel: primaryMtd.label,
      primaryCprValue: primaryMtd.cprValue,
      primaryCprLabel: primaryMtd.costLabel,
      budgetPctUsed: pctUsed !== null ? `${pctUsed}%` : "",
      activeCampaignCount: chartCampaigns.filter((d) => d.isActive).length,
    },
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
    creative: buildCreativeSections(globalWeekDateRange, primaryRawRows),
    creativeOnly: false,
    pausedMessage: null,
    chart,
    periodRow,
    mtdRow,
    tableHeaderLabels,
    combinedTotalStory,
    fileDateRange,
    objectiveWarnings,
  };
}

// ────────────────────── Previous Month Summary reports ─────────────────────
//
// A minimal, parallel data pipeline from buildReportData above — used only
// when the uploaded MTD Daily CSV has no usable current-period data at all
// (validate.ts's noCampaignData) but the client has Previous Month Data on
// file. There is no current-month data to build campaign/ad-set slides, a
// health score, or an MTD chart from, so this deliberately builds none of
// that: campaignSlides/adSetSlides stay empty and chart stays null, which
// render.ts's own campaign/ad-set/chart loop (guarded by `!data.isPaused`)
// already renders as "nothing" for free — no render.ts changes needed. The
// Combined Total table's own MTD row is forced hidden by hard-coding the
// Period row's sameMonthAsCurrentMTD true (see TableRowData's own doc
// comment on that field: "hides the MTD row entirely... rather than show
// two near-identical rows" — true here because there IS no current-month
// row worth showing), and the Metric Guide legend slide falls back to the
// template's own static content, exactly as it already does for any report
// with no dynamic metric selection (see collectLegendEntries/
// buildLegendSlideXml). reportType is left "WEEKLY" purely for
// buildTableSlideXml's/buildCoverSlideXml's own internal branching (neither
// treats it specially beyond the "MONTHLY hides the Period row" case, which
// doesn't apply here) — never written to the database as the stored
// Report.reportType, which the caller (route.ts) sets independently.
export interface BuildPreviousMonthSummaryReportDataInput {
  accountName: string;
  currencySymbol: string;
  timezone: string;
  /** Raw column-mapped rows from the client's Previous Month Data upload — see lib/nre/previous-month-data.ts. Must be non-empty; the caller is responsible for confirming Client.previousMonthDataUrl produced real rows before calling this. */
  periodRows: NreRow[];
  now?: Date;
}

export function buildPreviousMonthSummaryReportData(input: BuildPreviousMonthSummaryReportDataInput): ReportData {
  const { accountName, currencySymbol, timezone, periodRows, now = new Date() } = input;

  const objectiveMap = buildCampaignObjectiveMap(periodRows as MetricRow[]);
  const periodRow: TableRowData = {
    ...computeTableRow(periodRows as MetricRow[], currencySymbol, false, objectiveMap, now),
    sameMonthAsCurrentMTD: true,
  };
  const mtdRow = computeTableRow([], currencySymbol, true, new Map(), now);
  const tableHeaderLabels: TableHeaderLabels = {
    resultColumns: periodRow.resultColumns.map((c) => ({ label: c.label, costLabel: c.costLabel })),
  };

  // Same "MM-DD-YYYY, in the client's own timezone" computation buildReportData
  // itself uses for CoverData.reportDate.
  const reportDateParts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, month: "2-digit", day: "2-digit", year: "numeric" })
    .formatToParts(now)
    .reduce(
      (acc, part) => {
        if (part.type === "month") acc.month = part.value;
        if (part.type === "day") acc.day = part.value;
        if (part.type === "year") acc.year = part.value;
        return acc;
      },
      { month: "", day: "", year: "" } as { month: string; day: string; year: string },
    );
  const reportDateStr = `${reportDateParts.month}-${reportDateParts.day}-${reportDateParts.year}`;

  return {
    isPaused: false,
    platform: "META",
    reportType: "WEEKLY",
    cover: {
      accountName,
      reportDate: reportDateStr,
      dateRange: periodRow.fullMonthLabel,
      healthBadge: "📅 Previous Month Summary",
      healthScore: 0,
      budgetSummary: "",
    },
    campaignSlides: [],
    adSetSlides: [],
    pausedMessage: null,
    chart: null,
    periodRow,
    mtdRow,
    tableHeaderLabels,
    combinedTotalStory: buildCombinedTotalStory(periodRow, mtdRow, tableHeaderLabels, "WEEKLY"),
    fileDateRange: periodRow.fullMonthLabel,
    objectiveWarnings: [],
  };
}

// ─────────────────────────── Comparison reports ────────────────────────────
//
// A separate, parallel data pipeline from buildReportData above — comparison
// reports don't have a "weekly vs MTD" split, a health score, ad-set slides,
// or an MTD chart; they split the same MTD Daily CSV into two arbitrary
// custom date windows (Period A/B) and compare one campaign against itself
// across both. Deliberately not threaded through buildReportData's own
// reportType branches (WEEKLY/MONTHLY) — see comparison-slides.ts, which
// renders this output with its own from-scratch OOXML slide builders,
// entirely independent of fill-tags.ts's template-based campaign/ad-set/
// chart slide rendering.

/** One metric's raw numeric value alongside its already-formatted display string — comparison-slides.ts renders `formatted`; buildComparisonReportData's own % change math (see computeChange) uses `value`. */
export interface ComparisonMetricValue {
  value: number;
  formatted: string;
}

export interface ComparisonMetricSet {
  spend: ComparisonMetricValue;
  reach: ComparisonMetricValue;
  results: ComparisonMetricValue;
  cpr: ComparisonMetricValue;
}

export type ComparisonDirection = "up" | "down" | "flat" | "new";

/**
 * `percent` is null exactly when Period B's value was 0 (and Period A's
 * wasn't) — comparison-slides.ts renders that as "NEW" instead of a
 * percentage, per spec. Both periods at 0 for a metric is treated as "flat"
 * (0%), not "New" — there's nothing to call new about a metric that stayed
 * at zero.
 */
export interface ComparisonChange {
  percent: number | null;
  direction: ComparisonDirection;
}

export interface ComparisonChanges {
  spend: ComparisonChange;
  reach: ComparisonChange;
  results: ComparisonChange;
  cpr: ComparisonChange;
}

export interface ComparisonCampaignData {
  campaignName: string;
  /** The campaign's own resultLabel (e.g. "PURCHASES") — Period A's detected objective wins when Period A has any rows for this campaign, since that's the more current/relevant period; falls back to Period B's when Period A is empty (a campaign that ran only in the earlier period). */
  objective: string;
  costLabel: string;
  metricsA: ComparisonMetricSet;
  metricsB: ComparisonMetricSet;
  changes: ComparisonChanges;
}

export interface ComparisonReportData {
  /** True only when BOTH periods have zero total spend across every campaign — mirrors ReportData.isPaused's "nothing to report" meaning, adapted for two periods instead of one. */
  isPaused: boolean;
  accountName: string;
  reportDate: string;
  /** e.g. "Aug 1 - Aug 6, 2026" — see dates.ts's getComparisonPeriodLabel. */
  periodALabel: string;
  periodBLabel: string;
  campaigns: ComparisonCampaignData[];
  totals: {
    metricsA: ComparisonMetricSet;
    metricsB: ComparisonMetricSet;
    changes: ComparisonChanges;
  };
}

export interface BuildComparisonReportDataInput {
  accountName: string;
  currencySymbol: string;
  timezone: string;
  /** Raw column-mapped rows from the "MTD Daily CSV" upload — comparison reports read directly from this, not from splitMtdDaily's weekly/MTD split, since Period A/B are arbitrary wizard-picked windows. */
  mtdDailyRows: NreRow[];
  /** See BuildReportDataInput.selectedCampaigns — same semantics. */
  selectedCampaigns?: string[] | null;
  periodA: DateRangeIso;
  periodB: DateRangeIso;
  now?: Date;
}

function filterRowsByDateRange<T extends NreRow>(rows: T[], range: DateRangeIso): T[] {
  const startTs = Date.parse(range.startIso + "T00:00:00Z");
  const endTs = Date.parse(range.endIso + "T00:00:00Z");
  return rows.filter((row) => {
    const d = parseDate(getRowDate(row));
    if (!d) return false;
    const ts = Date.UTC(d.year, d.month - 1, d.day);
    return ts >= startTs && ts <= endTs;
  });
}

/** Groups a date-filtered row set into per-campaign AggRow arrays — aggregateRows itself groups by campaign+ad-set (and runs the same 4-step objective-detection/correction chain every other report type relies on); this just re-groups its output by campaign alone, matching buildReportData's own campaignGroups pattern above. */
function groupAggRowsByCampaign(rows: NreRow[]): Record<string, AggRow[]> {
  const agg = aggregateRows(rows);
  const byCampaign: Record<string, AggRow[]> = {};
  agg.forEach((row) => {
    const name = (row.campaign_name || "Unknown Campaign").trim();
    (byCampaign[name] ??= []).push(row);
  });
  return byCampaign;
}

/**
 * Comparison Report's per-period, per-campaign totals for a campaign's ONE
 * assigned objective (from campaignObjectiveMap — see buildComparisonReportData
 * below). Single source of truth fix: this used to be pickPrimaryGroup,
 * which independently re-detected each PERIOD's own objective from
 * getResultGroups/resolveObjective — a campaign could show one objective
 * for Period A and a completely different one for Period B (both from the
 * SAME campaign), and neither was guaranteed to match what that campaign's
 * own slide or the Combined Total table displayed. Reusing
 * resultValueForObjective (the exact per-row correction
 * groupResultsByCampaignObjective already uses for the Combined Total
 * table's MTD/Previous Month rows) means a campaign with multiple ad sets —
 * one individually leaning toward a different objective than the campaign's
 * overall assigned one — can't have that mismatched ad set's own count
 * inflate this total either. `rows` may be empty (this campaign didn't run
 * at all in this period) — count/cpr are both simply 0 in that case, same
 * as pickPrimaryGroup's own null-for-empty behavior once formatted.
 */
function comparisonObjectiveTotals(rows: MetricRow[], objective: ResultLabels): { count: number; cpr: number } {
  let count = 0;
  let totalSpend = 0;
  let totalReach = 0;
  rows.forEach((row) => {
    const value = resultValueForObjective(row, objective.resultLabel);
    count += value;
    if (shouldAttributeSpendForObjective(row, objective.resultLabel, value)) {
      totalSpend += parseCellNum(row.spend);
      totalReach += parseCellNum(row.reach);
    }
  });
  // Same uncounted-Reach special case as buildResultGroups/
  // getGroupedResultDisplayForObjective: a real Reach objective rarely
  // populates a `results` count, so its cost is derived from spend/reach
  // (×1000) instead of spend/count.
  const isUncountedReach = objective.resultLabel === "REACH" && count === 0;
  const cpr = isUncountedReach
    ? totalReach > 0
      ? (totalSpend * 1000) / totalReach
      : 0
    : count > 0
      ? totalSpend / count
      : 0;
  return { count, cpr };
}

function comparisonMetricSet(spend: number, reach: number, results: number, cpr: number, currencySymbol: string): ComparisonMetricSet {
  return {
    spend: { value: spend, formatted: fmtCurrency(spend, currencySymbol) },
    reach: { value: reach, formatted: fmtNumber(reach) },
    results: { value: results, formatted: fmtNumber(results) },
    cpr: { value: cpr, formatted: cpr > 0 ? fmtCurrency2dp(cpr, currencySymbol) : "—" },
  };
}

/** `change = ((A - B) / B) * 100`, with the product spec's two documented special cases: B = 0 (and A != 0) reads "New" (percent: null); both zero reads flat/0%, not "New" (see ComparisonChange's own doc comment). Positive = improvement (green ↑) and negative = decline (red ↓) for every metric uniformly, including COST PER RESULT — a literal reading of the spec, not a domain-aware "lower cost is better" adjustment. */
function computeChange(a: number, b: number): ComparisonChange {
  if (b === 0) {
    if (a === 0) return { percent: 0, direction: "flat" };
    return { percent: null, direction: "new" };
  }
  const percent = ((a - b) / b) * 100;
  const direction: ComparisonDirection = percent > 0 ? "up" : percent < 0 ? "down" : "flat";
  return { percent, direction };
}

function sumField(rows: AggRow[], field: "spend" | "reach"): number {
  return rows.reduce((sum, r) => sum + (r[field] || 0), 0);
}

export function buildComparisonReportData(input: BuildComparisonReportDataInput): ComparisonReportData {
  const { accountName, currencySymbol, timezone, mtdDailyRows, selectedCampaigns, periodA, periodB, now = new Date() } = input;

  const campaignFilteredRows = filterRowsByCampaigns(mtdDailyRows, selectedCampaigns ?? null);
  const rowsA = filterRowsByDateRange(campaignFilteredRows, periodA);
  const rowsB = filterRowsByDateRange(campaignFilteredRows, periodB);

  const byCampaignA = groupAggRowsByCampaign(rowsA);
  const byCampaignB = groupAggRowsByCampaign(rowsB);

  const campaignNames = Array.from(new Set([...Object.keys(byCampaignA), ...Object.keys(byCampaignB)])).sort();

  // Single source of truth (reported bug: the chart slide showed "ADD TO
  // CART" for a purchase campaign — same audit flagged Comparison Reports as
  // having their own separate objective-detection logic, since fixed here
  // too) — ONE objective per campaign, covering BOTH periods' rows together,
  // so a campaign can never show Period A under one objective and Period B
  // under a different one purely because each period's own data leaned a
  // different way. Built from every row in this report's scope (both
  // periods combined, campaign-filtered), same aggregateRows-then-classify
  // pipeline every other campaignObjectiveMap in this file uses.
  const campaignObjectiveMap = buildCampaignObjectiveMap(aggregateRows([...rowsA, ...rowsB]));

  const campaigns: ComparisonCampaignData[] = campaignNames.map((campaignName) => {
    const campRowsA = byCampaignA[campaignName] ?? [];
    const campRowsB = byCampaignB[campaignName] ?? [];

    const spendA = sumField(campRowsA, "spend");
    const spendB = sumField(campRowsB, "spend");
    const reachA = sumField(campRowsA, "reach");
    const reachB = sumField(campRowsB, "reach");

    const campaignObjective = campaignObjectiveMap.get(normalizeCampaignName(campaignName)) ?? {
      resultLabel: "RESULTS",
      costLabel: "COST PER RESULT",
    };
    const objective = campaignObjective.resultLabel;
    const costLabel = campaignObjective.costLabel;
    const totalsA = comparisonObjectiveTotals(campRowsA, campaignObjective);
    const totalsB = comparisonObjectiveTotals(campRowsB, campaignObjective);
    const resultsA = totalsA.count;
    const resultsB = totalsB.count;
    const cprA = totalsA.cpr;
    const cprB = totalsB.cpr;

    return {
      campaignName,
      objective,
      costLabel,
      metricsA: comparisonMetricSet(spendA, reachA, resultsA, cprA, currencySymbol),
      metricsB: comparisonMetricSet(spendB, reachB, resultsB, cprB, currencySymbol),
      changes: {
        spend: computeChange(spendA, spendB),
        reach: computeChange(reachA, reachB),
        results: computeChange(resultsA, resultsB),
        cpr: computeChange(cprA, cprB),
      },
    };
  });

  let totalSpendA = 0;
  let totalSpendB = 0;
  let totalReachA = 0;
  let totalReachB = 0;
  let totalResultsA = 0;
  let totalResultsB = 0;
  campaigns.forEach((c) => {
    totalSpendA += c.metricsA.spend.value;
    totalSpendB += c.metricsB.spend.value;
    totalReachA += c.metricsA.reach.value;
    totalReachB += c.metricsB.reach.value;
    totalResultsA += c.metricsA.results.value;
    totalResultsB += c.metricsB.results.value;
  });
  const totalCprA = totalResultsA > 0 ? totalSpendA / totalResultsA : 0;
  const totalCprB = totalResultsB > 0 ? totalSpendB / totalResultsB : 0;

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

  return {
    isPaused: totalSpendA === 0 && totalSpendB === 0,
    accountName,
    reportDate: `${reportDate.month}-${reportDate.day}-${reportDate.year}`,
    periodALabel: getComparisonPeriodLabel(periodA.startIso, periodA.endIso),
    periodBLabel: getComparisonPeriodLabel(periodB.startIso, periodB.endIso),
    campaigns,
    totals: {
      metricsA: comparisonMetricSet(totalSpendA, totalReachA, totalResultsA, totalCprA, currencySymbol),
      metricsB: comparisonMetricSet(totalSpendB, totalReachB, totalResultsB, totalCprB, currencySymbol),
      changes: {
        spend: computeChange(totalSpendA, totalSpendB),
        reach: computeChange(totalReachA, totalReachB),
        results: computeChange(totalResultsA, totalResultsB),
        cpr: computeChange(totalCprA, totalCprB),
      },
    },
  };
}
