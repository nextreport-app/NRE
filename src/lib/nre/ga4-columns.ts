/**
 * GA4 CSV column auto-detection — keyword specs live in ga4-metric-dictionary.ts.
 */

export {
  GA4_METRIC_KEYS,
  GA4_COLUMN_KEYWORDS,
  type Ga4MetricKey,
} from "./ga4-metric-dictionary";

import {
  GA4_MATCH_PRIORITY,
  GA4_METRIC_KEYS,
  GA4_COLUMN_KEYWORDS,
  type Ga4MetricKey,
} from "./ga4-metric-dictionary";

export type Ga4ColumnMap = Partial<Record<Ga4MetricKey, string>>;

export function buildGa4ColumnMap(headers: string[]): Ga4ColumnMap {
  const map: Ga4ColumnMap = {};
  headers.forEach((header) => {
    if (!header) return;
    const h = String(header).toLowerCase().trim();
    for (const metric of GA4_MATCH_PRIORITY) {
      if (map[metric]) continue;
      const keywords = GA4_COLUMN_KEYWORDS[metric];
      if (keywords.some((kw) => h.includes(kw))) {
        map[metric] = header;
        break;
      }
    }
  });
  return map;
}

export type Ga4Row = Partial<Record<Ga4MetricKey, string>> & { _raw: Record<string, string> };

export function readGa4RowsWithAutoMap(
  headers: string[],
  dataRows: string[][],
): { colMap: Ga4ColumnMap; rows: Ga4Row[] } {
  const colMap = buildGa4ColumnMap(headers);
  const rows: Ga4Row[] = dataRows.map((cells) => {
    const _raw: Record<string, string> = {};
    headers.forEach((h, i) => {
      _raw[h] = cells[i] ?? "";
    });
    const row: Ga4Row = { _raw };
    for (const key of GA4_METRIC_KEYS) {
      const header = colMap[key];
      if (header && _raw[header] !== undefined) row[key] = _raw[header];
    }
    return row;
  });
  return { colMap, rows };
}

/** Which breakdown dimensions are present in this CSV. */
export function detectGa4CsvDimensions(colMap: Ga4ColumnMap): Ga4MetricKey[] {
  const dims: Ga4MetricKey[] = [];
  const dimKeys: Ga4MetricKey[] = [
    "channel",
    "device",
    "city",
    "region",
    "country",
    "campaign",
    "source",
    "medium",
    "landing_page",
    "age",
    "gender",
    "operating_system",
    "browser",
    "new_vs_returning",
    "day_of_week",
    "hour",
    "event_name",
  ];
  for (const k of dimKeys) {
    if (colMap[k]) dims.push(k);
  }
  return dims;
}
