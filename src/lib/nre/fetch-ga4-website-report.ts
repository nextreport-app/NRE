/**
 * Pulls GA4 website performance data via Data API and builds WebsiteReportData.
 */

import {
  parseGa4MetricTotals,
  parseGa4Rows,
  runGa4Report,
  toGa4Date,
  type Ga4DateRange,
} from "@/lib/ga4-api";
import {
  buildWebsiteReportData,
  ga4OverviewTotalsFromMetrics,
  type WebsiteReportData,
} from "@/lib/nre/website-report-data";
import { formatDateUS } from "@/lib/nre/dates";

/** GA4 Data API allows at most 10 metrics per runReport request — split overview fetch. */
const OVERVIEW_METRICS_PRIMARY = [
  "sessions",
  "totalUsers",
  "newUsers",
  "engagedSessions",
  "engagementRate",
  "bounceRate",
  "averageSessionDuration",
  "userEngagementDuration",
  "screenPageViews",
  "conversions",
] as const;

const OVERVIEW_METRICS_ECOMMERCE = ["purchaseRevenue", "transactions"] as const;

function dateRangeLabel(range: Ga4DateRange): string {
  return `${formatDateUS(range.startIso)} – ${formatDateUS(range.endIso)}`;
}

async function fetchOverviewTotals(
  accessToken: string,
  propertyId: string,
  range: Ga4DateRange,
  rangeName?: string,
) {
  const dateRanges = [{ startDate: toGa4Date(range.startIso), endDate: toGa4Date(range.endIso), name: rangeName }];

  const [primary, ecommerce] = await Promise.all([
    runGa4Report(accessToken, propertyId, {
      dateRanges,
      metrics: OVERVIEW_METRICS_PRIMARY.map((name) => ({ name })),
    }),
    runGa4Report(accessToken, propertyId, {
      dateRanges,
      metrics: OVERVIEW_METRICS_ECOMMERCE.map((name) => ({ name })),
    }),
  ]);

  return ga4OverviewTotalsFromMetrics({
    ...parseGa4MetricTotals(primary),
    ...parseGa4MetricTotals(ecommerce),
  });
}

async function fetchChannelBreakdown(accessToken: string, propertyId: string, range: Ga4DateRange) {
  const response = await runGa4Report(accessToken, propertyId, {
    dateRanges: [{ startDate: toGa4Date(range.startIso), endDate: toGa4Date(range.endIso) }],
    dimensions: [{ name: "sessionDefaultChannelGroup" }],
    metrics: [
      { name: "sessions" },
      { name: "engagementRate" },
      { name: "conversions" },
    ],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: 12,
  });

  return parseGa4Rows(response, ["sessionDefaultChannelGroup"], ["sessions", "engagementRate", "conversions"]).map(
    (row) => ({
      channel: String(row.sessionDefaultChannelGroup || "Unassigned"),
      sessions: Number(row.sessions ?? 0),
      engagementRate: Number(row.engagementRate ?? 0),
      conversions: Number(row.conversions ?? 0),
    }),
  );
}

async function fetchTopPages(accessToken: string, propertyId: string, range: Ga4DateRange) {
  const response = await runGa4Report(accessToken, propertyId, {
    dateRanges: [{ startDate: toGa4Date(range.startIso), endDate: toGa4Date(range.endIso) }],
    dimensions: [{ name: "landingPagePlusQueryString" }],
    metrics: [{ name: "sessions" }, { name: "engagementRate" }],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: 10,
  });

  return parseGa4Rows(response, ["landingPagePlusQueryString"], ["sessions", "engagementRate"]).map((row) => ({
    page: String(row.landingPagePlusQueryString || "/"),
    sessions: Number(row.sessions ?? 0),
    engagementRate: Number(row.engagementRate ?? 0),
  }));
}

export async function fetchGa4WebsiteReport(input: {
  accessToken: string;
  propertyId: string;
  propertyName: string;
  accountName?: string;
  currencySymbol: string;
  currentRange: Ga4DateRange;
  comparisonRange?: Ga4DateRange;
}): Promise<WebsiteReportData> {
  const { accessToken, propertyId, currentRange, comparisonRange } = input;

  const [current, previous, channels, topPages] = await Promise.all([
    fetchOverviewTotals(accessToken, propertyId, currentRange, "current"),
    comparisonRange
      ? fetchOverviewTotals(accessToken, propertyId, comparisonRange, "previous")
      : Promise.resolve(undefined),
    fetchChannelBreakdown(accessToken, propertyId, currentRange),
    fetchTopPages(accessToken, propertyId, currentRange),
  ]);

  return buildWebsiteReportData({
    propertyId,
    propertyName: input.propertyName,
    accountName: input.accountName,
    dateRangeLabel: dateRangeLabel(currentRange),
    comparisonRangeLabel: comparisonRange ? dateRangeLabel(comparisonRange) : undefined,
    currencySymbol: input.currencySymbol,
    current,
    previous,
    channels,
    topPages,
  });
}

/** Trailing calendar month ending yesterday, and the month before — for default website reports. */
export function defaultWebsiteReportRanges(timezone: string, now = new Date()): {
  current: Ga4DateRange;
  previous: Ga4DateRange;
} {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(now);
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const d = Number(parts.find((p) => p.type === "day")?.value);

  const yesterday = new Date(Date.UTC(y, m - 1, d - 1));
  const currentEnd = yesterday.toISOString().slice(0, 10);
  const currentStart = new Date(Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);

  const prevEndDate = new Date(Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), 0));
  const prevEnd = prevEndDate.toISOString().slice(0, 10);
  const prevStart = new Date(Date.UTC(prevEndDate.getUTCFullYear(), prevEndDate.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);

  return {
    current: { startIso: currentStart, endIso: currentEnd },
    previous: { startIso: prevStart, endIso: prevEnd },
  };
}
