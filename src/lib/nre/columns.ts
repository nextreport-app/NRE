/**
 * NRE v1 — column auto-detection.
 * Direct port of COLUMN_KEYWORDS / buildColumnMap_ / readTabWithAutoMap_
 * from meta_ads_report_v4.js. These are the exact fields the tested report
 * engine consumes — keep in sync with the Apps Script, do not add fields here
 * without also updating the aggregate/report logic that reads them.
 */

export const NRE_METRIC_KEYS = [
  "campaign_name",
  "ad_set_name",
  "result_type",
  "results",
  "spend",
  "reach",
  "impressions",
  "ctr",
  "cpc",
  "cpr",
  "link_clicks",
  "frequency",
  "date_start",
  "date_end",
  // Not part of the ported Apps Script — added for the MTD chart slide's
  // active-campaign count (product owner, from testing against real
  // accounts). Genuinely optional: a CSV without this column falls back to
  // the original spend-based "active" heuristic, see report-data.ts.
  "delivery_status",
  // Objective-specific result columns — not part of the ported Apps Script.
  // Read only by aggregate.ts's Step 3 data-value objective fallback (see
  // objective.ts): each is genuinely optional, and only consulted when
  // neither result_type text nor a recognized column NAME (Step 2) resolved
  // the objective. Distinct from the generic `results` field above, which
  // stays as the primary displayed count regardless of which of these (if
  // any) also matched.
  "purchases",
  "website_leads",
  "meta_leads",
  "leads",
  "landing_page_views",
] as const;

export type NreMetricKey = (typeof NRE_METRIC_KEYS)[number];

export const COLUMN_KEYWORDS: Record<NreMetricKey, string[]> = {
  campaign_name: ["campaign name", "campaign"],
  ad_set_name: ["ad set name", "adset name", "ad group name", "ad group"],
  result_type: ["result type", "objective", "conversion type"],
  // Never include "leads" here. "Website leads" / "On-Facebook leads" contain
  // that substring and used to steal the Results mapping whenever they
  // appeared earlier in the file than the real Results column — which is the
  // Combined Total (monthly) slide reading the wrong column.
  results: ["results", "conversions", "clicks total"],
  // "cost" was removed deliberately (product owner, real-account bug
  // report): it's a substring of "Cost per Result"/"Cost per Click"/"Cost
  // per Lead"/etc, so a per-result cost column appearing earlier in the
  // file than the real spend column would silently win and zero out spend
  // (those columns are blank until a campaign has results).
  spend: ["amount spent", "spend", "total spend", "spent"],
  reach: ["reach"],
  impressions: ["impressions"],
  ctr: ["ctr", "click-through rate", "click through rate"],
  cpc: ["cpc", "cost per click", "cost per link click"],
  cpr: ["cost per result", "cost per conversion", "cost per lead", "cpl", "cpa"],
  link_clicks: ["link clicks", "clicks (all)", "clicks (link)"],
  frequency: ["frequency", "ad frequency", "avg. frequency"],
  date_start: ["reporting starts", "date start", "start date", "from date"],
  date_end: ["reporting ends", "date end", "end date", "to date"],
  delivery_status: ["delivery status", "effective status", "ad set delivery", "campaign delivery"],
  purchases: ["purchases"],
  website_leads: ["website lead"],
  meta_leads: ["meta lead", "on-facebook lead", "leads (form)"],
  leads: ["leads"],
  landing_page_views: ["landing page view", "lpv"],
};

/** Count metrics must never bind to a "Cost per …" header. */
const COST_HEADER = /^(cost per|cost \/|avg\.?\s*cost|cpc|cpm|cpl|cpa)\b/;
const COUNT_METRICS = new Set<NreMetricKey>([
  "results",
  "reach",
  "impressions",
  "link_clicks",
  "purchases",
  "website_leads",
  "meta_leads",
  "leads",
  "landing_page_views",
]);

function headerMatchesKeyword(header: string, keyword: string, metric: NreMetricKey): boolean {
  const h = header.toLowerCase().trim();
  const k = keyword.toLowerCase();
  if (COUNT_METRICS.has(metric) && COST_HEADER.test(h)) return false;
  if (metric === "leads") {
    // Bare "Leads" / "Lead" only — never "Website leads" or "Meta leads".
    return /^(on-facebook\s+)?leads?( \(\s*form\s*\))?$/.test(h);
  }
  if (metric === "reach") {
    return /^reach\b/.test(h) && !COST_HEADER.test(h) && !h.includes("cost per");
  }
  return h.includes(k);
}

function bestKeywordLength(header: string, metric: NreMetricKey, keywords: string[]): number {
  let best = 0;
  for (const keyword of keywords) {
    if (headerMatchesKeyword(header, keyword, metric) && keyword.length > best) best = keyword.length;
  }
  return best;
}

export type ColumnMap = Partial<Record<NreMetricKey, string>>;

/**
 * Maps each NRE field to at most one CSV header.
 *
 * Longest keyword wins per header, so "Website leads" binds to website_leads
 * (keyword "website lead") instead of results/leads (keyword "leads"). First
 * header in file order still wins when two headers score equally for the
 * same metric. This is the universal column binder — do not add per-objective
 * if-else here.
 */
export function buildColumnMap(headers: string[]): ColumnMap {
  const map: ColumnMap = {};
  const assignedHeaders = new Set<string>();

  headers.forEach((header) => {
    if (!header || assignedHeaders.has(header)) return;
    let winner: NreMetricKey | null = null;
    let winnerScore = 0;
    (Object.entries(COLUMN_KEYWORDS) as [NreMetricKey, string[]][]).forEach(([metric, keywords]) => {
      if (map[metric]) return;
      const score = bestKeywordLength(header, metric, keywords);
      if (score > winnerScore) {
        winnerScore = score;
        winner = metric;
      }
    });
    if (winner) {
      map[winner] = header;
      assignedHeaders.add(header);
    }
  });

  if (!map.results) {
    const dedicated = [map.website_leads, map.meta_leads, map.leads, map.purchases, map.landing_page_views].filter(
      (h): h is string => Boolean(h),
    );
    if (dedicated.length === 1) map.results = dedicated[0];
  }

  return map;
}

export type NreRow = Partial<Record<NreMetricKey, string>> & { _raw: Record<string, string> };

/** Port of readTabWithAutoMap_, operating on parsed CSV headers + string rows. */
export function readRowsWithAutoMap(headers: string[], dataRows: string[][]): {
  colMap: ColumnMap;
  rows: NreRow[];
} {
  const colMap = buildColumnMap(headers);
  const headerIndex: Record<string, number> = {};
  headers.forEach((h, i) => {
    if (h) headerIndex[String(h)] = i;
  });

  const rows = dataRows
    .filter((row) => row.some((cell) => cell !== "" && cell !== null && cell !== undefined))
    .map((row) => {
      const obj: NreRow = { _raw: {} };
      headers.forEach((h, i) => {
        if (h) obj._raw[h] = row[i] ?? "";
      });
      (Object.entries(colMap) as [NreMetricKey, string][]).forEach(([metric, header]) => {
        obj[metric] = row[headerIndex[header]] || "";
      });
      return obj;
    });

  return { colMap, rows };
}

/**
 * Port of the inline getRowDate() helper inside splitMTDDaily_ — the
 * "Reporting starts/ends" columns hold the export's overall date range
 * (constant across every row), and Meta daily exports can additionally carry
 * campaign-level "Starts"/"Ends" columns (also constant per campaign, and
 * "Ends" may read "Ongoing" for active campaigns) — none of these represent
 * a given row's actual date. Only a column whose header is exactly "Day" or
 * "Date" does.
 *
 * Matching is done on the trimmed, lowercased header rather than exact
 * bracket lookups (`raw["Day"]`) so real-world header variance — trailing
 * whitespace, "DAY", "date " — can't cause a silent fall-through to one of
 * those decoy columns. This is a whole-header match, not a substring one:
 * "Reporting starts"/"Starts"/"Ends" never equal "day" or "date" outright,
 * so they can never be picked up here even by accident.
 */
/** The value of a real per-row "Day"/"Date" column, or null if this row has neither — shared by getRowDate (which additionally falls back to date_start) and hasRealRowDate (which deliberately does NOT). */
function findRealDayOrDateValue(row: NreRow): string | null {
  const raw = row._raw || {};
  const normalized = Object.entries(raw).map(([header, value]) => [header.trim().toLowerCase(), value] as const);

  const day = normalized.find(([h, v]) => h === "day" && v);
  if (day) return day[1];

  const date = normalized.find(([h, v]) => h === "date" && v);
  if (date) return date[1];

  return null;
}

export function getRowDate(row: NreRow): string {
  // Last-resort fallback for exports with no real per-row date column at
  // all (rare) — matches the source's own fallback to date_start.
  return findRealDayOrDateValue(row) ?? row.date_start ?? "";
}

/**
 * True when `row` has a real per-row "Day"/"Date" column value — as
 * opposed to only a file-wide "Reporting starts"/"Reporting ends" range
 * (which getRowDate() falls back to, but which every row shares the same
 * value for). A CSV where every row's date comes only from that fallback
 * means the export has no daily granularity at all — see validate.ts's
 * "weekly or monthly totals instead of daily data" check, which uses this
 * to catch that before it produces garbage weekly/MTD splits downstream.
 */
export function hasRealRowDate(row: NreRow): boolean {
  return findRealDayOrDateValue(row) !== null;
}
