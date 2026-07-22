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
 *  - The Reach-as-proxy / no-result-type-but-has-clicks corrections below are
 *    the actual live data-first objective detection used in production.
 */

import { parseCellNum } from "./format";
import { parseDate } from "./dates";
import { getResultLabels } from "./objective";
import { getRowDate, type NreRow } from "./columns";

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
}

interface GroupAcc {
  campaign_name: string;
  ad_set_name: string;
  result_type: string;
  spend: number;
  reach: number;
  impressions: number;
  results: number;
  link_clicks: number;
  ctrs: number[];
  cpcs: number[];
  freqs: number[];
  earliest_date: string;
  latest_date: string;
}

function average(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

/** Port of the aggregate() closure inside splitMTDDaily_. */
export function aggregateRows(rowsToAgg: NreRow[]): AggRow[] {
  const groups: Record<string, GroupAcc> = {};

  rowsToAgg.forEach((row) => {
    const key = [row.campaign_name, row.ad_set_name].join("|||");
    if (!groups[key]) {
      groups[key] = {
        campaign_name: row.campaign_name || "",
        ad_set_name: row.ad_set_name || "",
        result_type: "",
        spend: 0,
        reach: 0,
        impressions: 0,
        results: 0,
        link_clicks: 0,
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
    g.spend += parseCellNum(row.spend);
    g.reach += parseCellNum(row.reach);
    g.impressions += parseCellNum(row.impressions);
    g.results += parseCellNum(row.results);
    g.link_clicks += parseCellNum(row.link_clicks || "0");

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

    const { resultLabel } = getResultLabels(g.result_type);
    let cpr: number;
    if (resultLabel === "REACH") {
      cpr = g.reach > 0 ? (g.spend * 1000) / g.reach : 0;
    } else {
      cpr = g.results > 0 ? g.spend / g.results : 0;
    }

    // DATA-FIRST objective correction — never trust result_type alone.
    // Priority: Purchases > Leads > LPV > Link Clicks > Reach.
    // (Meta sometimes exports "Reach" as result_type for Traffic campaigns.)
    let actualResultType = g.result_type;
    let actualResults = g.results;
    let actualCpr = cpr;

    if (
      resultLabel === "REACH" &&
      g.link_clicks > 0 &&
      Math.abs(g.results - g.reach) <= Math.max(g.reach * 0.03, 5)
    ) {
      // Reach count ≈ result count → Reach used as a proxy for a Traffic campaign.
      actualResultType = "Link click";
      actualResults = g.link_clicks;
      actualCpr = g.link_clicks > 0 ? g.spend / g.link_clicks : 0;
    } else if (resultLabel === "RESULTS" && g.link_clicks > 0 && g.results === 0) {
      // No result type set but link clicks exist → Traffic.
      actualResultType = "Link click";
      actualResults = g.link_clicks;
      actualCpr = g.link_clicks > 0 ? g.spend / g.link_clicks : 0;
    }

    return {
      campaign_name: g.campaign_name,
      ad_set_name: g.ad_set_name,
      result_type: actualResultType,
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
}

/**
 * Port of splitMTDDaily_(). `now` is injectable for testing; defaults to the
 * real clock, matching the Apps Script's use of the server's UTC date.
 */
export function splitMtdDaily(rows: NreRow[], now: Date = new Date()): SplitMtdDailyResult | null {
  if (rows.length === 0) return null;

  let latestTs: number | null = null;
  rows.forEach((row) => {
    const d = parseDate(getRowDate(row));
    if (!d) return;
    const ts = Date.UTC(d.year, d.month - 1, d.day);
    if (latestTs === null || ts > latestTs) latestTs = ts;
  });
  if (latestTs === null) return null;

  // ALWAYS cap at YESTERDAY — today's data is incomplete (day still running).
  const todayStartTs = new Date(now.toISOString().split("T")[0] + "T00:00:00Z").getTime();
  const yesterdayTs = todayStartTs - 24 * 60 * 60 * 1000;
  if (latestTs > yesterdayTs) {
    latestTs = yesterdayTs;
  }

  const validRows = rows.filter((row) => {
    const d = parseDate(getRowDate(row));
    if (!d) return false;
    const ts = Date.UTC(d.year, d.month - 1, d.day);
    return ts <= yesterdayTs;
  });
  if (validRows.length === 0) return null;

  const weekStartTs = latestTs - 6 * 24 * 60 * 60 * 1000; // 7 days ending yesterday

  const weeklyRaw = validRows.filter((row) => {
    const d = parseDate(getRowDate(row));
    if (!d) return false;
    const ts = Date.UTC(d.year, d.month - 1, d.day);
    return ts >= weekStartTs && ts <= (latestTs as number);
  });

  const weeklyRows = aggregateRows(weeklyRaw);
  const mtdRows = aggregateRows(validRows); // MTD = all valid days up to and including yesterday

  return { weeklyRows, mtdRows };
}
