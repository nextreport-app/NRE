/**
 * GA4 metric dictionary — single source of truth for CSV header keywords and
 * GA4 Data API metric names. Powers ga4-columns.ts column auto-detection and
 * fetch-ga4-website-report.ts metric selection.
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

export interface Ga4MetricSpec {
  key: Ga4MetricKey;
  /** GA4 Data API metric resource name(s). */
  apiNames: readonly string[];
  /** Substrings matched against CSV export headers. */
  csvKeywords: readonly string[];
  /** Column match priority — higher-specificity metrics first. */
  matchPriority: number;
}

export const GA4_METRIC_SPECS: readonly Ga4MetricSpec[] = [
  { key: "avg_session_duration", apiNames: ["averageSessionDuration"], csvKeywords: ["average session duration", "avg. session duration", "avg session duration"], matchPriority: 100 },
  { key: "avg_engagement_time", apiNames: ["userEngagementDuration"], csvKeywords: ["average engagement time", "user engagement duration", "avg engagement time"], matchPriority: 99 },
  { key: "engagement_rate", apiNames: ["engagementRate"], csvKeywords: ["engagement rate"], matchPriority: 98 },
  { key: "bounce_rate", apiNames: ["bounceRate"], csvKeywords: ["bounce rate"], matchPriority: 97 },
  { key: "engaged_sessions", apiNames: ["engagedSessions"], csvKeywords: ["engaged sessions"], matchPriority: 96 },
  { key: "new_vs_returning", apiNames: ["newVsReturning"], csvKeywords: ["new vs returning", "new/returning"], matchPriority: 95 },
  { key: "operating_system", apiNames: ["operatingSystem"], csvKeywords: ["operating system", "os"], matchPriority: 94 },
  { key: "landing_page", apiNames: ["landingPage"], csvKeywords: ["landing page", "page path", "page path and screen class"], matchPriority: 93 },
  { key: "day_of_week", apiNames: ["dayOfWeek"], csvKeywords: ["day of week", "weekday"], matchPriority: 92 },
  { key: "purchase_revenue", apiNames: ["purchaseRevenue"], csvKeywords: ["purchase revenue", "total revenue", "revenue"], matchPriority: 91 },
  { key: "screen_page_views", apiNames: ["screenPageViews"], csvKeywords: ["views", "screen page views", "page views"], matchPriority: 90 },
  { key: "total_users", apiNames: ["totalUsers"], csvKeywords: ["total users", "users", "active users"], matchPriority: 89 },
  { key: "event_name", apiNames: ["eventName"], csvKeywords: ["event name"], matchPriority: 88 },
  { key: "campaign", apiNames: ["sessionCampaignName"], csvKeywords: ["session campaign", "campaign"], matchPriority: 87 },
  { key: "channel", apiNames: ["sessionDefaultChannelGroup"], csvKeywords: ["session default channel group", "default channel group", "channel group", "channel"], matchPriority: 86 },
  { key: "device", apiNames: ["deviceCategory"], csvKeywords: ["device category", "device"], matchPriority: 85 },
  { key: "region", apiNames: ["region"], csvKeywords: ["region", "state"], matchPriority: 84 },
  { key: "country", apiNames: ["country"], csvKeywords: ["country"], matchPriority: 83 },
  { key: "browser", apiNames: ["browser"], csvKeywords: ["browser"], matchPriority: 82 },
  { key: "gender", apiNames: ["userGender"], csvKeywords: ["user gender", "gender"], matchPriority: 81 },
  { key: "source", apiNames: ["sessionSource"], csvKeywords: ["session source", "source"], matchPriority: 80 },
  { key: "medium", apiNames: ["sessionMedium"], csvKeywords: ["session medium", "medium"], matchPriority: 79 },
  { key: "new_users", apiNames: ["newUsers"], csvKeywords: ["new users"], matchPriority: 78 },
  { key: "conversions", apiNames: ["conversions"], csvKeywords: ["conversions", "key events"], matchPriority: 77 },
  { key: "transactions", apiNames: ["transactions"], csvKeywords: ["transactions", "ecommerce purchases"], matchPriority: 76 },
  { key: "sessions", apiNames: ["sessions"], csvKeywords: ["sessions"], matchPriority: 75 },
  { key: "city", apiNames: ["city"], csvKeywords: ["city"], matchPriority: 74 },
  { key: "hour", apiNames: ["hour"], csvKeywords: ["hour", "hour of day"], matchPriority: 73 },
  { key: "age", apiNames: ["userAgeBracket"], csvKeywords: ["user age bracket", "age", "age bracket"], matchPriority: 72 },
  { key: "date", apiNames: ["date"], csvKeywords: ["date", "day"], matchPriority: 71 },
];

/** Derived from GA4_METRIC_SPECS — same shape ga4-columns.ts used historically. */
export const GA4_COLUMN_KEYWORDS: Record<Ga4MetricKey, string[]> = Object.fromEntries(
  GA4_METRIC_KEYS.map((key) => {
    const spec = GA4_METRIC_SPECS.find((s) => s.key === key);
    return [key, spec ? [...spec.csvKeywords] : []];
  }),
) as Record<Ga4MetricKey, string[]>;

export const GA4_MATCH_PRIORITY: Ga4MetricKey[] = [...GA4_METRIC_SPECS]
  .sort((a, b) => b.matchPriority - a.matchPriority)
  .map((s) => s.key);

/** All GA4 Data API metric names used in website reporting. */
export const GA4_API_METRIC_NAMES: string[] = [
  ...new Set(GA4_METRIC_SPECS.flatMap((s) => s.apiNames)),
];

export function ga4MetricSpec(key: Ga4MetricKey): Ga4MetricSpec | undefined {
  return GA4_METRIC_SPECS.find((s) => s.key === key);
}
