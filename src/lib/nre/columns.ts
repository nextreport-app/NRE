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
] as const;

export type NreMetricKey = (typeof NRE_METRIC_KEYS)[number];

export const COLUMN_KEYWORDS: Record<NreMetricKey, string[]> = {
  campaign_name: ["campaign name", "campaign"],
  ad_set_name: ["ad set name", "adset name", "ad group name", "ad group"],
  result_type: ["result type", "objective", "conversion type"],
  results: ["results", "conversions", "leads", "clicks total"],
  spend: ["amount spent", "spend", "cost", "spent"],
  reach: ["reach"],
  impressions: ["impressions"],
  ctr: ["ctr", "click-through rate", "click through rate"],
  cpc: ["cpc", "cost per click", "cost per link click"],
  cpr: ["cost per result", "cost per conversion", "cost per lead", "cpl", "cpa"],
  link_clicks: ["link clicks", "clicks (all)", "clicks (link)"],
  frequency: ["frequency", "ad frequency", "avg. frequency"],
  date_start: ["reporting starts", "date start", "start date", "from date"],
  date_end: ["reporting ends", "date end", "end date", "to date"],
};

export type ColumnMap = Partial<Record<NreMetricKey, string>>;

/** Port of buildColumnMap_ — first header (in order) to match a metric's keywords wins. */
export function buildColumnMap(headers: string[]): ColumnMap {
  const map: ColumnMap = {};
  headers.forEach((header) => {
    if (!header) return;
    const h = String(header).toLowerCase().trim();
    (Object.entries(COLUMN_KEYWORDS) as [NreMetricKey, string[]][]).forEach(
      ([metric, keywords]) => {
        if (!map[metric] && keywords.some((kw) => h.includes(kw))) map[metric] = header;
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
export function getRowDate(row: NreRow): string {
  const raw = row._raw || {};
  const normalized = Object.entries(raw).map(([header, value]) => [header.trim().toLowerCase(), value] as const);

  const day = normalized.find(([h, v]) => h === "day" && v);
  if (day) return day[1];

  const date = normalized.find(([h, v]) => h === "date" && v);
  if (date) return date[1];

  // Last-resort fallback for exports with no real per-row date column at
  // all (rare) — matches the source's own fallback to date_start.
  return row.date_start || "";
}
