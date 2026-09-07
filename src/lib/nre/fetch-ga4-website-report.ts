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
  DEFAULT_WEBSITE_REPORT_CONFIG,
  monthToDateRange,
  resolveWebsiteReportRanges,
  type WebsiteGeoDimension,
  type WebsiteReportConfig,
} from "@/lib/nre/website-report-config";
import {
  buildWebsiteReportData,
  ga4OverviewTotalsFromMetrics,
  type WebsiteClientKind,
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

const GEO_DIMENSION_API: Record<WebsiteGeoDimension, string> = {
  city: "city",
  region: "region",
  country: "country",
};

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
    metrics: [{ name: "sessions" }, { name: "engagementRate" }, { name: "conversions" }],
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

async function fetchDeviceBreakdown(accessToken: string, propertyId: string, range: Ga4DateRange) {
  const response = await runGa4Report(accessToken, propertyId, {
    dateRanges: [{ startDate: toGa4Date(range.startIso), endDate: toGa4Date(range.endIso) }],
    dimensions: [{ name: "deviceCategory" }],
    metrics: [{ name: "sessions" }, { name: "engagementRate" }, { name: "conversions" }],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: 6,
  });

  return parseGa4Rows(response, ["deviceCategory"], ["sessions", "engagementRate", "conversions"]).map((row) => ({
    device: String(row.deviceCategory || "Unknown"),
    sessions: Number(row.sessions ?? 0),
    engagementRate: Number(row.engagementRate ?? 0),
    conversions: Number(row.conversions ?? 0),
  }));
}

async function fetchGeoBreakdown(
  accessToken: string,
  propertyId: string,
  range: Ga4DateRange,
  dimension: WebsiteGeoDimension,
) {
  const dimName = GEO_DIMENSION_API[dimension];
  const response = await runGa4Report(accessToken, propertyId, {
    dateRanges: [{ startDate: toGa4Date(range.startIso), endDate: toGa4Date(range.endIso) }],
    dimensions: [{ name: dimName }],
    metrics: [{ name: "sessions" }, { name: "conversions" }],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: 10,
  });

  return parseGa4Rows(response, [dimName], ["sessions", "conversions"]).map((row) => ({
    location: String(row[dimName] || "(not set)"),
    sessions: Number(row.sessions ?? 0),
    conversions: Number(row.conversions ?? 0),
  }));
}

async function fetchCampaignBreakdown(accessToken: string, propertyId: string, range: Ga4DateRange) {
  const response = await runGa4Report(accessToken, propertyId, {
    dateRanges: [{ startDate: toGa4Date(range.startIso), endDate: toGa4Date(range.endIso) }],
    dimensions: [{ name: "sessionCampaignName" }],
    metrics: [{ name: "sessions" }, { name: "engagementRate" }, { name: "conversions" }],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: 10,
  });

  return parseGa4Rows(response, ["sessionCampaignName"], ["sessions", "engagementRate", "conversions"]).map((row) => ({
    campaign: String(row.sessionCampaignName || "(not set)"),
    sessions: Number(row.sessions ?? 0),
    engagementRate: Number(row.engagementRate ?? 0),
    conversions: Number(row.conversions ?? 0),
  }));
}

async function fetchSourceBreakdown(accessToken: string, propertyId: string, range: Ga4DateRange) {
  const response = await runGa4Report(accessToken, propertyId, {
    dateRanges: [{ startDate: toGa4Date(range.startIso), endDate: toGa4Date(range.endIso) }],
    dimensions: [{ name: "sessionSource" }, { name: "sessionMedium" }],
    metrics: [{ name: "sessions" }, { name: "engagementRate" }, { name: "conversions" }],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: 10,
  });

  return parseGa4Rows(response, ["sessionSource", "sessionMedium"], ["sessions", "engagementRate", "conversions"]).map(
    (row) => ({
      source: String(row.sessionSource || "(not set)"),
      medium: String(row.sessionMedium || "(not set)"),
      sessions: Number(row.sessions ?? 0),
      engagementRate: Number(row.engagementRate ?? 0),
      conversions: Number(row.conversions ?? 0),
    }),
  );
}

async function fetchAgeBreakdown(accessToken: string, propertyId: string, range: Ga4DateRange) {
  const response = await runGa4Report(accessToken, propertyId, {
    dateRanges: [{ startDate: toGa4Date(range.startIso), endDate: toGa4Date(range.endIso) }],
    dimensions: [{ name: "userAgeBracket" }],
    metrics: [{ name: "sessions" }, { name: "conversions" }],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: 10,
  });

  return parseGa4Rows(response, ["userAgeBracket"], ["sessions", "conversions"]).map((row) => ({
    segment: String(row.userAgeBracket || "Unknown"),
    sessions: Number(row.sessions ?? 0),
    conversions: Number(row.conversions ?? 0),
  }));
}

async function fetchGenderBreakdown(accessToken: string, propertyId: string, range: Ga4DateRange) {
  const response = await runGa4Report(accessToken, propertyId, {
    dateRanges: [{ startDate: toGa4Date(range.startIso), endDate: toGa4Date(range.endIso) }],
    dimensions: [{ name: "userGender" }],
    metrics: [{ name: "sessions" }, { name: "conversions" }],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: 6,
  });

  return parseGa4Rows(response, ["userGender"], ["sessions", "conversions"]).map((row) => ({
    segment: String(row.userGender || "Unknown"),
    sessions: Number(row.sessions ?? 0),
    conversions: Number(row.conversions ?? 0),
  }));
}

async function fetchAudienceBreakdown(accessToken: string, propertyId: string, range: Ga4DateRange) {
  const response = await runGa4Report(accessToken, propertyId, {
    dateRanges: [{ startDate: toGa4Date(range.startIso), endDate: toGa4Date(range.endIso) }],
    dimensions: [{ name: "newVsReturning" }],
    metrics: [{ name: "sessions" }, { name: "engagementRate" }, { name: "conversions" }],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: 4,
  });

  return parseGa4Rows(response, ["newVsReturning"], ["sessions", "engagementRate", "conversions"]).map((row) => ({
    segment: String(row.newVsReturning || "Unknown"),
    sessions: Number(row.sessions ?? 0),
    engagementRate: Number(row.engagementRate ?? 0),
    conversions: Number(row.conversions ?? 0),
  }));
}

async function fetchOsBreakdown(accessToken: string, propertyId: string, range: Ga4DateRange) {
  const response = await runGa4Report(accessToken, propertyId, {
    dateRanges: [{ startDate: toGa4Date(range.startIso), endDate: toGa4Date(range.endIso) }],
    dimensions: [{ name: "operatingSystem" }],
    metrics: [{ name: "sessions" }, { name: "engagementRate" }, { name: "conversions" }],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: 8,
  });

  return parseGa4Rows(response, ["operatingSystem"], ["sessions", "engagementRate", "conversions"]).map((row) => ({
    name: String(row.operatingSystem || "Unknown"),
    sessions: Number(row.sessions ?? 0),
    engagementRate: Number(row.engagementRate ?? 0),
    conversions: Number(row.conversions ?? 0),
  }));
}

async function fetchBrowserBreakdown(accessToken: string, propertyId: string, range: Ga4DateRange) {
  const response = await runGa4Report(accessToken, propertyId, {
    dateRanges: [{ startDate: toGa4Date(range.startIso), endDate: toGa4Date(range.endIso) }],
    dimensions: [{ name: "browser" }],
    metrics: [{ name: "sessions" }, { name: "engagementRate" }, { name: "conversions" }],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: 8,
  });

  return parseGa4Rows(response, ["browser"], ["sessions", "engagementRate", "conversions"]).map((row) => ({
    name: String(row.browser || "Unknown"),
    sessions: Number(row.sessions ?? 0),
    engagementRate: Number(row.engagementRate ?? 0),
    conversions: Number(row.conversions ?? 0),
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
  config?: WebsiteReportConfig;
}): Promise<WebsiteReportData> {
  const { accessToken, propertyId, currentRange, comparisonRange } = input;
  const config = input.config ?? DEFAULT_WEBSITE_REPORT_CONFIG;
  const breakdowns = config.breakdowns;

  const [
    current,
    previous,
    channels,
    topPages,
    devices,
    geoLocations,
    campaigns,
    sources,
    ageGroups,
    genders,
    audience,
    operatingSystems,
    browsers,
  ] = await Promise.all([
    fetchOverviewTotals(accessToken, propertyId, currentRange, "current"),
    comparisonRange
      ? fetchOverviewTotals(accessToken, propertyId, comparisonRange, "previous")
      : Promise.resolve(undefined),
    breakdowns.channels ? fetchChannelBreakdown(accessToken, propertyId, currentRange) : Promise.resolve([]),
    breakdowns.topPages ? fetchTopPages(accessToken, propertyId, currentRange) : Promise.resolve([]),
    breakdowns.device ? fetchDeviceBreakdown(accessToken, propertyId, currentRange) : Promise.resolve([]),
    breakdowns.geo
      ? fetchGeoBreakdown(accessToken, propertyId, currentRange, breakdowns.geoDimension)
      : Promise.resolve([]),
    breakdowns.campaigns ? fetchCampaignBreakdown(accessToken, propertyId, currentRange) : Promise.resolve([]),
    breakdowns.sources ? fetchSourceBreakdown(accessToken, propertyId, currentRange) : Promise.resolve([]),
    breakdowns.demographics ? fetchAgeBreakdown(accessToken, propertyId, currentRange) : Promise.resolve([]),
    breakdowns.demographics ? fetchGenderBreakdown(accessToken, propertyId, currentRange) : Promise.resolve([]),
    breakdowns.newVsReturning ? fetchAudienceBreakdown(accessToken, propertyId, currentRange) : Promise.resolve([]),
    breakdowns.operatingSystem ? fetchOsBreakdown(accessToken, propertyId, currentRange) : Promise.resolve([]),
    breakdowns.browser ? fetchBrowserBreakdown(accessToken, propertyId, currentRange) : Promise.resolve([]),
  ]);

  let clientKindOverride: WebsiteClientKind | undefined;
  if (config.clientKind !== "auto") {
    clientKindOverride = config.clientKind;
  }

  return buildWebsiteReportData({
    propertyId,
    propertyName: input.propertyName,
    accountName: input.accountName,
    dateRangeLabel: dateRangeLabel(currentRange),
    comparisonRangeLabel: comparisonRange ? dateRangeLabel(comparisonRange) : undefined,
    currencySymbol: input.currencySymbol,
    current,
    previous,
    clientKindOverride,
    channels,
    devices,
    geoLocations,
    geoDimension: breakdowns.geoDimension,
    campaigns,
    sources,
    ageGroups,
    genders,
    audience,
    operatingSystems,
    browsers,
    topPages,
    breakdowns,
  });
}

/** @deprecated Use resolveWebsiteReportRanges from website-report-config */
export function defaultWebsiteReportRanges(timezone: string, now = new Date()): {
  current: Ga4DateRange;
  previous: Ga4DateRange;
} {
  const current = monthToDateRange(timezone, now);
  const config = { ...DEFAULT_WEBSITE_REPORT_CONFIG, comparePreviousPeriod: true };
  const { previous } = resolveWebsiteReportRanges(config, timezone, now);
  return { current, previous: previous! };
}

export { resolveWebsiteReportRanges };
