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
  // Layer 1 (objective-detection rebuild) — a correctly-bound sibling of
  // meta_leads above, added rather than renaming it in place: meta_leads'
  // own keyword list ("meta lead") never actually matches Meta's real
  // column names for this objective ("On-Facebook Leads"/"Leads (form)"),
  // but resolveObjective/health.ts's getResultGroups already depend on
  // meta_leads' exact (broken) current behavior and must not change — see
  // this field's own COLUMN_KEYWORDS entry below for the real bindings.
  "meta_form_leads",
  "leads",
  "landing_page_views",
] as const;

export type NreMetricKey = (typeof NRE_METRIC_KEYS)[number];

export const COLUMN_KEYWORDS: Record<NreMetricKey, string[]> = {
  campaign_name: ["campaign name", "campaign"],
  ad_set_name: ["ad set name", "adset name", "ad group name", "ad group"],
  result_type: ["result type", "objective", "conversion type"],
  // "leads" removed (objective-detection rebuild, Layer 1) — it used to
  // match ANY header containing "leads" as a substring, so "Website leads",
  // "On-Facebook Leads", and "Leads (form)" all double-bound to `results`
  // as well as their own specific field below. The real "Results" column is
  // always literally named "Results"/"Conversions" on a real Meta export —
  // never bare "Leads" — so this narrowing is safe.
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
  meta_leads: ["meta lead"],
  // Correctly bound counterpart of meta_leads above — matches Meta's real
  // on-Facebook-lead-form export column names ("On-Facebook Leads",
  // "Leads (form)"), which "meta lead" never did. Deliberately does NOT
  // include a bare "lead" substring, or it would also double-bind "Website
  // leads" — buildColumnMap's own leads-family exclusivity check below
  // additionally guarantees a header claimed here never also claims the
  // generic `leads` field.
  meta_form_leads: ["on-facebook lead", "on facebook lead", "leads (form)", "form lead"],
  leads: ["leads"],
  landing_page_views: ["landing page view", "lpv"],
};

export type ColumnMap = Partial<Record<NreMetricKey, string>>;

/** Port of buildColumnMap_ — first header (in order) to match a metric's keywords wins. */
export function buildColumnMap(headers: string[]): ColumnMap {
  const map: ColumnMap = {};
  headers.forEach((header) => {
    if (!header) return;
    const h = String(header).toLowerCase().trim();
    // Layer 1 (objective-detection rebuild) — the "leads" family's single
    // known keyword overlap: website_leads' and meta_form_leads' own
    // keywords are always substrings of a header the generic `leads`
    // catch-all would also match (e.g. "website lead" ⊂ "website leads" ⊂
    // "leads"). A header already claimed by either specific field must
    // never ALSO double-bind to the generic one, or a "Website leads"/
    // "On-Facebook leads"/"Leads (form)" column would map to two internal
    // fields at once and the objective resolver could read the wrong one.
    // Every other metric's own keyword list has no such overlap, so only
    // this one case needs special-casing rather than a full rewrite of the
    // matching algorithm below.
    const claimedBySpecificLead =
      COLUMN_KEYWORDS.website_leads.some((kw) => h.includes(kw)) ||
      COLUMN_KEYWORDS.meta_form_leads.some((kw) => h.includes(kw));
    (Object.entries(COLUMN_KEYWORDS) as [NreMetricKey, string[]][]).forEach(
      ([metric, keywords]) => {
        if (map[metric]) return;
        if (metric === "leads" && claimedBySpecificLead) return;
        if (keywords.some((kw) => h.includes(kw))) map[metric] = header;
      },
    );
  });
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
