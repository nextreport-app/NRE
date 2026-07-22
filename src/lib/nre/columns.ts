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
 * "Reporting starts/ends" columns hold the export's overall date range, but
 * each row's actual date lives in a "Day"/"Date" column that may not map to
 * a standard keyword, so it's read straight from _raw.
 */
export function getRowDate(row: NreRow): string {
  const raw = row._raw || {};
  return raw["Day"] || raw["day"] || raw["Date"] || raw["date"] || row.date_start || "";
}
