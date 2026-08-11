/**
 * NRE v1 — MTD Daily CSV split + aggregation.
 * Direct port of splitMTDDaily_() (and its nested aggregate()/getRowDate())
 * from meta_ads_report_v4.js. This is the primary (and, per the product
 * spec's "Recommended" single-download workflow, the only) ingestion path:
 * one day-by-day CSV covering the month, auto-split into a trailing-7-day
 * "weekly" slice and a full month-to-date slice.
 *
 * CRITICAL, do not change without re-reading the source comments:
 *  - Rows are grouped by campaign_name + ad_set_name ONLY, never by
 *    result_type — Meta leaves result_type empty on zero-result days, which
 *    would otherwise split one ad set into two groups.
 *  - "Today" (server UTC date) is always excluded — its data is incomplete.
 *  - The objective correction below is the actual live 4-step detection
 *    used in production — see objective.ts's OBJECTIVE_CATALOG doc comment
 *    for the full priority chain this implements.
 */

import { parseCellNum } from "./format";
import { parseDate } from "./dates";
import { canonicalResultTypeText, detectObjectiveFromColumns, resolveObjective } from "./objective";
import { getRowDate, type NreRow } from "./columns";
import { computeEffectiveYesterday, type DateRangeIso } from "./date-range";

export interface AggRow {
  campaign_name: string;
  ad_set_name: string;
  result_type: string;
  spend: number;
  reach: number;
  impressions: number;
  results: number;
  link_clicks: number;
  ctr: number;
  cpc: number;
  cpr: number;
  frequency: number;
  date_start: string;
  date_end: string;
  /** Raw text, e.g. "Active"/"Not delivering"/"Paused" — see delivery-status.ts. Empty when the CSV has no delivery-status column, or no row for this group had one set. */
  delivery_status: string;
  /**
   * False when the objective was only resolved via Step 3 (data values) or
   * Step 4 (generic fallback) of the priority chain — i.e. neither the
   * result_type column nor a recognized column name gave a confident
   * answer. Drives the "objective auto-detected" warning on the upload
   * preview step (see report-data.ts).
   */
  objectiveConfident: boolean;
}

interface GroupAcc {
  campaign_name: string;
  ad_set_name: string;
  result_type: string;
  delivery_status: string;
  spend: number;
  reach: number;
  impressions: number;
  results: number;
  link_clicks: number;
  purchases: number;
  website_leads: number;
  meta_leads: number;
  leads: number;
  landing_page_views: number;
  /**
   * Priority-1 "exotic" signals (see objective.ts's resolveObjective doc
   * comment) — not part of NRE_METRIC_KEYS/columns.ts's mapped-field set,
   * so unlike purchases/website_leads/etc above these aren't already on
   * NreRow; summed straight from each row's own _raw via
   * sumRawColumnByKeywords below.
   */
  mobile_app_installs: number;
  messaging_conversations_started: number;
  thruplays: number;
  ctrs: number[];
  cpcs: number[];
  freqs: number[];
  earliest_date: string;
  latest_date: string;
}

function average(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

/**
 * Sums a row's raw CSV column value(s) whose header text contains any of the
 * given keywords — used for the 3 Priority-1 signals that have no dedicated
 * mapped field on NreRow (mobile app installs, messaging conversations
 * started, thruplays), mirroring detectObjectiveFromColumns' own
 * substring-match approach but reading values instead of just presence.
 */
function sumRawColumnByKeywords(raw: Record<string, string> | undefined, keywords: string[]): number {
  if (!raw) return 0;
  let total = 0;
  for (const [header, value] of Object.entries(raw)) {
    const h = header.toLowerCase();
    if (keywords.some((k) => h.includes(k))) total += parseCellNum(value);
  }
  return total;
}

/** Port of the aggregate() closure inside splitMTDDaily_. */
export function aggregateRows(rowsToAgg: NreRow[]): AggRow[] {
  const groups: Record<string, GroupAcc> = {};

  // Column-presence objective signal (priority 2 — see objective.ts's
  // detectObjectiveFromColumns) computed once from the file's own headers,
  // not per-row: which columns exist is a property of the upload itself,
  // identical for every row/group in it. Every row's _raw carries every
  // header key regardless of value (see columns.ts's readRowsWithAutoMap),
  // so the first row's keys are the full header list.
  const rawHeaders = rowsToAgg.length > 0 ? Object.keys(rowsToAgg[0]._raw || {}) : [];
  const columnObjective = detectObjectiveFromColumns(rawHeaders);

  rowsToAgg.forEach((row) => {
    const key = [row.campaign_name, row.ad_set_name].join("|||");
    if (!groups[key]) {
      groups[key] = {
        campaign_name: row.campaign_name || "",
        ad_set_name: row.ad_set_name || "",
        result_type: "",
        delivery_status: "",
        spend: 0,
        reach: 0,
        impressions: 0,
        results: 0,
        link_clicks: 0,
        purchases: 0,
        website_leads: 0,
        meta_leads: 0,
        leads: 0,
        landing_page_views: 0,
        mobile_app_installs: 0,
        messaging_conversations_started: 0,
        thruplays: 0,
        ctrs: [],
        cpcs: [],
        freqs: [],
        earliest_date: "",
        latest_date: "",
      };
    }
    const g = groups[key];

    if (row.result_type && row.result_type.trim()) {
      g.result_type = row.result_type.trim();
    }
    if (row.delivery_status && row.delivery_status.trim()) {
      g.delivery_status = row.delivery_status.trim();
    }
    g.spend += parseCellNum(row.spend);
    g.reach += parseCellNum(row.reach);
    g.impressions += parseCellNum(row.impressions);
    g.results += parseCellNum(row.results);
    g.link_clicks += parseCellNum(row.link_clicks || "0");
    g.purchases += parseCellNum(row.purchases);
    g.website_leads += parseCellNum(row.website_leads);
    g.meta_leads += parseCellNum(row.meta_leads);
    g.leads += parseCellNum(row.leads);
    g.landing_page_views += parseCellNum(row.landing_page_views);
    g.mobile_app_installs += sumRawColumnByKeywords(row._raw, ["mobile app install", "app install"]);
    g.messaging_conversations_started += sumRawColumnByKeywords(row._raw, ["messaging conversations started"]);
    g.thruplays += sumRawColumnByKeywords(row._raw, ["thruplay"]);

    const ctr = parseCellNum(row.ctr);
    const freq = parseCellNum(row.frequency);
    const cpcRaw = parseCellNum(row.cpc);
    if (ctr > 0) g.ctrs.push(ctr);
    if (freq > 0) g.freqs.push(freq);
    if (cpcRaw > 0) g.cpcs.push(cpcRaw);

    const rowDate = getRowDate(row);
    if (rowDate) {
      if (!g.earliest_date || rowDate < g.earliest_date) g.earliest_date = rowDate;
      if (!g.latest_date || rowDate > g.latest_date) g.latest_date = rowDate;
    }
  });

  return Object.values(groups).map((g): AggRow => {
    const ctr = average(g.ctrs);
    const frq = average(g.freqs);
    // CPC: average the platform-calculated daily CPC values (more reliable
    // than spend/link_clicks, which is 0 when the link_clicks column is empty).
    const cpc = g.cpcs.length > 0 ? average(g.cpcs) : g.link_clicks > 0 ? g.spend / g.link_clicks : 0;

    // Unified objective priority chain — see objective.ts's resolveObjective
    // doc comment for the full Priority 1-4 rationale (Priority 1: dedicated
    // metric columns with a real non-zero value, the fix for the reported
    // "Website Leads shown as Landing Page Views" bug; Priority 2: result_type
    // text, preserved verbatim; Priority 3: column presence only; Priority 4:
    // remaining data-value fallbacks, then the generic RESULTS bucket).
    const resolution = resolveObjective(
      {
        result_type: g.result_type,
        results: g.results,
        reach: g.reach,
        purchases: g.purchases,
        website_leads: g.website_leads,
        meta_leads: g.meta_leads,
        leads: g.leads,
        landing_page_views: g.landing_page_views,
        link_clicks: g.link_clicks,
        mobile_app_installs: g.mobile_app_installs,
        messaging_conversations_started: g.messaging_conversations_started,
        thruplays: g.thruplays,
      },
      columnObjective,
    );

    let actualResultType = g.result_type;
    let actualResults = g.results;
    let actualCpr: number;
    let objectiveConfident: boolean;

    if (resolution.source === "resultType") {
      // Trust result_type text as-is, no correction needed — preserve the
      // row's own raw text exactly rather than substituting canonical text.
      actualCpr =
        resolution.resultLabel === "REACH"
          ? g.reach > 0
            ? (g.spend * 1000) / g.reach
            : 0
          : g.results > 0
            ? g.spend / g.results
            : 0;
      objectiveConfident = true;
    } else if (resolution.source === "priority1" || resolution.source === "priority3") {
      // Priority 1 (a dedicated metric column has real current data) and
      // Priority 3 (a specific objective column exists in the CSV, even with
      // no results yet) are both confident, non-guessed signals.
      actualResultType = canonicalResultTypeText(resolution.resultLabel);
      objectiveConfident = true;
      switch (resolution.resultLabel) {
        case "PURCHASES":
          actualResults = g.purchases;
          break;
        case "WEBSITE LEADS":
          actualResults = g.website_leads;
          break;
        case "META FORM LEADS":
          actualResults = g.leads > 0 ? g.leads : g.meta_leads;
          break;
        case "APP INSTALLS":
          actualResults = resolution.source === "priority1" ? g.mobile_app_installs : g.results;
          break;
        case "MESSAGING LEADS":
          actualResults = resolution.source === "priority1" ? g.messaging_conversations_started : g.results;
          break;
        case "VIDEO VIEWS":
          actualResults = resolution.source === "priority1" ? g.thruplays : g.results;
          break;
        default:
          actualResults = g.results;
      }
      actualCpr = actualResults > 0 ? g.spend / actualResults : 0;
    } else {
      // Priority 4: remaining data-value fallbacks (meta leads, landing page
      // views, link clicks, reach), or the absolute-last-resort generic
      // RESULTS bucket — none of these are confident signals.
      actualResultType = canonicalResultTypeText(resolution.resultLabel);
      objectiveConfident = false;
      switch (resolution.resultLabel) {
        case "META FORM LEADS":
          actualResults = g.meta_leads;
          actualCpr = g.spend / g.meta_leads;
          break;
        case "LANDING PAGE VIEWS":
          actualResults = g.landing_page_views;
          actualCpr = g.spend / g.landing_page_views;
          break;
        case "LINK CLICKS":
          actualResults = g.link_clicks;
          actualCpr = g.spend / g.link_clicks;
          break;
        case "REACH":
          actualResults = 0;
          actualCpr = g.reach > 0 ? (g.spend * 1000) / g.reach : 0;
          break;
        default:
          actualCpr = g.results > 0 ? g.spend / g.results : 0;
      }
    }

    return {
      campaign_name: g.campaign_name,
      ad_set_name: g.ad_set_name,
      result_type: actualResultType,
      delivery_status: g.delivery_status,
      objectiveConfident,
      spend: g.spend,
      reach: g.reach,
      impressions: g.impressions,
      results: actualResults,
      link_clicks: g.link_clicks,
      ctr,
      cpc,
      cpr: actualCpr,
      frequency: frq,
      date_start: g.earliest_date,
      date_end: g.latest_date,
    };
  });
}

export interface SplitMtdDailyResult {
  weeklyRows: AggRow[];
  mtdRows: AggRow[];
  /**
   * The same weekly/MTD row populations as weeklyRows/mtdRows, but before
   * aggregateRows collapses them and drops each row's `_raw` — additive
   * passthrough for the dynamic metric dictionary system
   * (dynamic-metrics.ts), which needs the original CSV column values
   * aggregateRows never keeps. Nothing else reads these; existing callers
   * that only destructure weeklyRows/mtdRows are unaffected.
   */
  weeklyRawRows: NreRow[];
  mtdRawRows: NreRow[];
}

export interface SplitMtdDailyOptions {
  /**
   * Explicit weekly window (inclusive, "YYYY-MM-DD"), from the report
   * upload wizard's date-range step — overrides the default "7 days ending
   * yesterday" auto-computation. Never affects MTD, which always covers the
   * full reporting month regardless of the weekly selection.
   */
  weeklyRange?: DateRangeIso;
}

/**
 * Port of splitMTDDaily_(). `now` is injectable for testing; defaults to the
 * real clock, matching the Apps Script's use of the server's UTC date.
 */
export function splitMtdDaily(
  rows: NreRow[],
  now: Date = new Date(),
  options: SplitMtdDailyOptions = {},
): SplitMtdDailyResult | null {
  if (rows.length === 0) return null;

  // ALWAYS cap at YESTERDAY — today's data is incomplete (day still running).
  const yesterday = computeEffectiveYesterday(rows, now);
  if (!yesterday) return null;
  const yesterdayTs = Date.UTC(yesterday.year, yesterday.month - 1, yesterday.day);

  const validRows = rows.filter((row) => {
    const d = parseDate(getRowDate(row));
    if (!d) return false;
    const ts = Date.UTC(d.year, d.month - 1, d.day);
    return ts <= yesterdayTs;
  });
  if (validRows.length === 0) return null;

  const weekEndTs = options.weeklyRange ? Date.parse(options.weeklyRange.endIso + "T00:00:00Z") : yesterdayTs;
  const weekStartTs = options.weeklyRange
    ? Date.parse(options.weeklyRange.startIso + "T00:00:00Z")
    : yesterdayTs - 6 * 24 * 60 * 60 * 1000; // default: 7 days ending yesterday

  const weeklyRaw = validRows.filter((row) => {
    const d = parseDate(getRowDate(row));
    if (!d) return false;
    const ts = Date.UTC(d.year, d.month - 1, d.day);
    return ts >= weekStartTs && ts <= weekEndTs;
  });
  const weeklyRows = aggregateRows(weeklyRaw);

  // MTD = day 1 of the reporting month through yesterday — explicitly
  // bounded (not just "every valid row in the file") so it always matches
  // exactly what the wizard's "MTD period: ..." confirmation shows,
  // regardless of the weekly selection above.
  const monthStartTs = Date.UTC(yesterday.year, yesterday.month - 1, 1);
  const mtdRaw = validRows.filter((row) => {
    const d = parseDate(getRowDate(row));
    if (!d) return false;
    const ts = Date.UTC(d.year, d.month - 1, d.day);
    return ts >= monthStartTs && ts <= yesterdayTs;
  });
  const mtdRows = aggregateRows(mtdRaw);

  return { weeklyRows, mtdRows, weeklyRawRows: weeklyRaw, mtdRawRows: mtdRaw };
}
