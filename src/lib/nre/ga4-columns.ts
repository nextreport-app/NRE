/**
 * GA4 CSV column auto-detection — maps GA4 report export headers to typed rows.
 */

export const GA4_METRIC_KEYS = [
  "date",
  "sessions",
  "total_users",
  "new_users",
  "engaged_sessions",
  "engagement_rate",
  "bounce_rate",
  "avg_session_duration",
  "avg_engagement_time",
  "screen_page_views",
  "conversions",
  "purchase_revenue",
  "transactions",
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
] as const;

export type Ga4MetricKey = (typeof GA4_METRIC_KEYS)[number];

export const GA4_COLUMN_KEYWORDS: Record<Ga4MetricKey, string[]> = {
  date: ["date", "day"],
  sessions: ["sessions"],
  total_users: ["total users", "users", "active users"],
  new_users: ["new users"],
  engaged_sessions: ["engaged sessions"],
  engagement_rate: ["engagement rate"],
  bounce_rate: ["bounce rate"],
  avg_session_duration: ["average session duration", "avg. session duration", "avg session duration"],
  avg_engagement_time: ["average engagement time", "user engagement duration", "avg engagement time"],
  screen_page_views: ["views", "screen page views", "page views"],
  conversions: ["conversions", "key events"],
  purchase_revenue: ["purchase revenue", "total revenue", "revenue"],
  transactions: ["transactions", "ecommerce purchases"],
  channel: ["session default channel group", "default channel group", "channel group", "channel"],
  device: ["device category", "device"],
  city: ["city"],
  region: ["region", "state"],
  country: ["country"],
  campaign: ["session campaign", "campaign"],
  source: ["session source", "source"],
  medium: ["session medium", "medium"],
  landing_page: ["landing page", "page path", "page path and screen class"],
  age: ["user age bracket", "age", "age bracket"],
  gender: ["user gender", "gender"],
  operating_system: ["operating system", "os"],
  browser: ["browser"],
  new_vs_returning: ["new vs returning", "new/returning"],
  day_of_week: ["day of week", "weekday"],
  hour: ["hour", "hour of day"],
  event_name: ["event name", "event"],
};

const MATCH_PRIORITY: Ga4MetricKey[] = [
  "avg_session_duration",
  "avg_engagement_time",
  "engagement_rate",
  "bounce_rate",
  "engaged_sessions",
  "new_vs_returning",
  "operating_system",
  "landing_page",
  "day_of_week",
  "purchase_revenue",
  "screen_page_views",
  "total_users",
  "event_name",
  "campaign",
  "channel",
  "device",
  "region",
  "country",
  "browser",
  "gender",
  "source",
  "medium",
  "new_users",
  "conversions",
  "transactions",
  "sessions",
  "city",
  "hour",
  "age",
  "date",
];

export type Ga4ColumnMap = Partial<Record<Ga4MetricKey, string>>;

export function buildGa4ColumnMap(headers: string[]): Ga4ColumnMap {
  const map: Ga4ColumnMap = {};
  headers.forEach((header) => {
    if (!header) return;
    const h = String(header).toLowerCase().trim();
    for (const metric of MATCH_PRIORITY) {
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
