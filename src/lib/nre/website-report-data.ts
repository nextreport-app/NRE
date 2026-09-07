/**
 * Website Traffic report data — separate from Meta/Google Ads ReportData.
 */

import type { WebsiteBreakdownOptions, WebsiteGeoDimension } from "./website-report-config";
export type {
  WebsiteBreakdownOptions,
  WebsiteClientKindSetting,
  WebsiteDatePreset,
  WebsiteGeoDimension,
  WebsiteReportConfig,
} from "./website-report-config";
export {
  DEFAULT_WEBSITE_BREAKDOWNS,
  DEFAULT_WEBSITE_REPORT_CONFIG,
  MAX_WEBSITE_BREAKDOWN_SLIDES,
  countSelectedBreakdowns,
  estimateWebsiteSlideCount,
  geoColumnHeader,
  geoSlideTitle,
  parseWebsiteBreakdownOptions,
  parseWebsiteReportConfig,
  normalizeBreakdowns,
  parseWebsiteReportConfigFromSearchParams,
  resolveWebsiteReportRanges,
  websiteConfigToQueryString,
} from "./website-report-config";

export type WebsiteClientKind = "lead_gen" | "ecommerce" | "content" | "saas";

export interface WebsiteMetricCard {
  key: string;
  label: string;
  value: string;
  previousValue?: string;
  changeLabel?: string;
}

export interface WebsiteChannelRow {
  channel: string;
  sessions: number;
  sessionsLabel: string;
  engagementRate: number;
  engagementRateLabel: string;
  conversions: number;
  conversionsLabel: string;
}

export interface WebsitePageRow {
  page: string;
  sessions: number;
  sessionsLabel: string;
  engagementRate: number;
  engagementRateLabel: string;
}

export interface WebsiteDeviceRow {
  device: string;
  sessions: number;
  sessionsLabel: string;
  engagementRate: number;
  engagementRateLabel: string;
  conversions: number;
  conversionsLabel: string;
}

export interface WebsiteGeoRow {
  location: string;
  sessions: number;
  sessionsLabel: string;
  shareOfSessions: number;
  shareLabel: string;
  conversions: number;
  conversionsLabel: string;
  conversionRateLabel: string;
}

export interface WebsiteCampaignRow {
  campaign: string;
  sessions: number;
  sessionsLabel: string;
  engagementRate: number;
  engagementRateLabel: string;
  conversions: number;
  conversionsLabel: string;
}

export interface WebsiteSourceRow {
  source: string;
  medium: string;
  label: string;
  sessions: number;
  sessionsLabel: string;
  engagementRate: number;
  engagementRateLabel: string;
  conversions: number;
  conversionsLabel: string;
}

export interface WebsiteDemographicRow {
  segment: string;
  sessions: number;
  sessionsLabel: string;
  conversions: number;
  conversionsLabel: string;
  conversionRateLabel: string;
}

export interface WebsiteAudienceRow {
  segment: string;
  sessions: number;
  sessionsLabel: string;
  engagementRate: number;
  engagementRateLabel: string;
  conversions: number;
  conversionsLabel: string;
}

export interface WebsiteTechRow {
  name: string;
  sessions: number;
  sessionsLabel: string;
  engagementRate: number;
  engagementRateLabel: string;
  conversions: number;
  conversionsLabel: string;
}

export interface WebsiteTimeRow {
  label: string;
  sessions: number;
  sessionsLabel: string;
  engagementRate: number;
  engagementRateLabel: string;
  conversions: number;
  conversionsLabel: string;
  conversionRateLabel: string;
}

export interface WebsiteConversionEventRow {
  event: string;
  count: number;
  countLabel: string;
  sessions: number;
  sessionsLabel: string;
  conversionRateLabel: string;
}

export interface WebsiteReportData {
  version: 1;
  kind: "website";
  propertyId: string;
  propertyName: string;
  accountName: string;
  dateRangeLabel: string;
  comparisonRangeLabel?: string;
  currencySymbol: string;
  clientKind: WebsiteClientKind;
  overviewMetrics: WebsiteMetricCard[];
  conversionMetrics: WebsiteMetricCard[];
  channels: WebsiteChannelRow[];
  devices: WebsiteDeviceRow[];
  /** Geo rows — cities, states/regions, or countries depending on geoDimension */
  geoCities: WebsiteGeoRow[];
  geoDimension: WebsiteGeoDimension;
  campaigns: WebsiteCampaignRow[];
  sources: WebsiteSourceRow[];
  ageGroups: WebsiteDemographicRow[];
  genders: WebsiteDemographicRow[];
  audience: WebsiteAudienceRow[];
  operatingSystems: WebsiteTechRow[];
  browsers: WebsiteTechRow[];
  topPages: WebsitePageRow[];
  dayOfWeek: WebsiteTimeRow[];
  hourOfDay: WebsiteTimeRow[];
  conversionEvents: WebsiteConversionEventRow[];
  breakdowns: WebsiteBreakdownOptions;
  /** Shown when demographics selected — Google Signals caveat */
  demographicsNote?: string;
  attributionNote: string;
}

export interface Ga4OverviewTotals {
  sessions: number;
  totalUsers: number;
  newUsers: number;
  engagedSessions: number;
  engagementRate: number;
  bounceRate: number;
  averageSessionDuration: number;
  userEngagementDuration: number;
  screenPageViews: number;
  conversions: number;
  purchaseRevenue: number;
  transactions: number;
}

export function emptyGa4OverviewTotals(): Ga4OverviewTotals {
  return {
    sessions: 0,
    totalUsers: 0,
    newUsers: 0,
    engagedSessions: 0,
    engagementRate: 0,
    bounceRate: 0,
    averageSessionDuration: 0,
    userEngagementDuration: 0,
    screenPageViews: 0,
    conversions: 0,
    purchaseRevenue: 0,
    transactions: 0,
  };
}

export function ga4OverviewTotalsFromMetrics(m: Record<string, number>): Ga4OverviewTotals {
  const engagementRate = m.engagementRate ?? 0;
  return {
    sessions: m.sessions ?? 0,
    totalUsers: m.totalUsers ?? 0,
    newUsers: m.newUsers ?? 0,
    engagedSessions: m.engagedSessions ?? 0,
    engagementRate,
    bounceRate: m.bounceRate ?? Math.max(0, 1 - engagementRate),
    averageSessionDuration: m.averageSessionDuration ?? 0,
    userEngagementDuration: m.userEngagementDuration ?? 0,
    screenPageViews: m.screenPageViews ?? 0,
    conversions: m.conversions ?? 0,
    purchaseRevenue: m.purchaseRevenue ?? 0,
    transactions: m.transactions ?? 0,
  };
}

function fmtInt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

function fmtPct(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

function fmtDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0s";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

function fmtCurrency(amount: number, symbol: string): string {
  return `${symbol}${amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function changeLabel(current: number, previous: number): string | undefined {
  if (previous <= 0) return current > 0 ? "new" : undefined;
  const pct = ((current - previous) / previous) * 100;
  const sign = pct >= 0 ? "+" : "−";
  return `${sign}${Math.abs(pct).toFixed(1)}%`;
}

function metricCard(
  key: string,
  label: string,
  current: string,
  previous?: number,
  currentRaw?: number,
  formatPrev?: (n: number) => string,
): WebsiteMetricCard {
  const card: WebsiteMetricCard = { key, label, value: current };
  if (previous !== undefined && formatPrev && currentRaw !== undefined) {
    card.previousValue = formatPrev(previous);
    card.changeLabel = changeLabel(currentRaw, previous);
  }
  return card;
}

export function detectWebsiteClientKind(totals: Ga4OverviewTotals): WebsiteClientKind {
  if (totals.purchaseRevenue > 0 || totals.transactions > 0) return "ecommerce";
  if (totals.conversions > 0) return "lead_gen";
  return "content";
}

function mapGeoRows(
  rows: Array<{ location: string; sessions: number; conversions: number }>,
  totalSessions: number,
): WebsiteGeoRow[] {
  return rows.map((g) => ({
    location: g.location,
    sessions: g.sessions,
    sessionsLabel: fmtInt(g.sessions),
    shareOfSessions: g.sessions / totalSessions,
    shareLabel: fmtPct(g.sessions / totalSessions),
    conversions: g.conversions,
    conversionsLabel: fmtInt(g.conversions),
    conversionRateLabel: g.sessions > 0 ? fmtPct(g.conversions / g.sessions) : "0.0%",
  }));
}

function mapDemographicRows(
  rows: Array<{ segment: string; sessions: number; conversions: number }>,
): WebsiteDemographicRow[] {
  return rows.map((r) => ({
    segment: r.segment,
    sessions: r.sessions,
    sessionsLabel: fmtInt(r.sessions),
    conversions: r.conversions,
    conversionsLabel: fmtInt(r.conversions),
    conversionRateLabel: r.sessions > 0 ? fmtPct(r.conversions / r.sessions) : "0.0%",
  }));
}

export function buildWebsiteReportData(input: {
  propertyId: string;
  propertyName: string;
  accountName?: string;
  dateRangeLabel: string;
  comparisonRangeLabel?: string;
  currencySymbol: string;
  current: Ga4OverviewTotals;
  previous?: Ga4OverviewTotals;
  clientKindOverride?: WebsiteClientKind;
  channels: Array<{ channel: string; sessions: number; engagementRate: number; conversions: number }>;
  devices?: Array<{ device: string; sessions: number; engagementRate: number; conversions: number }>;
  geoLocations?: Array<{ location: string; sessions: number; conversions: number }>;
  geoDimension?: WebsiteGeoDimension;
  campaigns?: Array<{ campaign: string; sessions: number; engagementRate: number; conversions: number }>;
  sources?: Array<{ source: string; medium: string; sessions: number; engagementRate: number; conversions: number }>;
  ageGroups?: Array<{ segment: string; sessions: number; conversions: number }>;
  genders?: Array<{ segment: string; sessions: number; conversions: number }>;
  audience?: Array<{ segment: string; sessions: number; engagementRate: number; conversions: number }>;
  operatingSystems?: Array<{ name: string; sessions: number; engagementRate: number; conversions: number }>;
  browsers?: Array<{ name: string; sessions: number; engagementRate: number; conversions: number }>;
  topPages: Array<{ page: string; sessions: number; engagementRate: number }>;
  dayOfWeek?: Array<{ label: string; sessions: number; engagementRate: number; conversions: number }>;
  hourOfDay?: Array<{ label: string; sessions: number; engagementRate: number; conversions: number }>;
  conversionEvents?: Array<{ event: string; count: number; sessions: number; conversionRate: number }>;
  breakdowns?: WebsiteBreakdownOptions;
}): WebsiteReportData {
  const { current, previous, currencySymbol } = input;
  const clientKind = input.clientKindOverride ?? detectWebsiteClientKind(current);
  const breakdowns = input.breakdowns;
  const totalSessions = Math.max(current.sessions, 1);

  const overviewMetrics: WebsiteMetricCard[] = [
    metricCard("sessions", "Sessions", fmtInt(current.sessions), previous?.sessions, current.sessions, fmtInt),
    metricCard("totalUsers", "Total Users", fmtInt(current.totalUsers), previous?.totalUsers, current.totalUsers, fmtInt),
    metricCard("newUsers", "New Users", fmtInt(current.newUsers), previous?.newUsers, current.newUsers, fmtInt),
    metricCard(
      "engagedSessions",
      "Engaged Sessions",
      fmtInt(current.engagedSessions),
      previous?.engagedSessions,
      current.engagedSessions,
      fmtInt,
    ),
    metricCard(
      "engagementRate",
      "Engagement Rate",
      fmtPct(current.engagementRate),
      previous?.engagementRate,
      current.engagementRate,
      fmtPct,
    ),
    metricCard(
      "bounceRate",
      "Bounce Rate",
      fmtPct(current.bounceRate),
      previous?.bounceRate,
      current.bounceRate,
      fmtPct,
    ),
    metricCard(
      "avgSessionDuration",
      "Avg Session Duration",
      fmtDuration(current.averageSessionDuration),
      previous?.averageSessionDuration,
      current.averageSessionDuration,
      fmtDuration,
    ),
    metricCard(
      "avgEngagementTime",
      "Avg Engagement Time",
      fmtDuration(current.userEngagementDuration / Math.max(current.sessions, 1)),
      previous
        ? previous.userEngagementDuration / Math.max(previous.sessions, 1)
        : undefined,
      current.userEngagementDuration / Math.max(current.sessions, 1),
      fmtDuration,
    ),
  ];

  const conversionMetrics: WebsiteMetricCard[] = [];

  if (clientKind === "ecommerce") {
    conversionMetrics.push(
      metricCard(
        "purchaseRevenue",
        "Purchase Revenue",
        fmtCurrency(current.purchaseRevenue, currencySymbol),
        previous?.purchaseRevenue,
        current.purchaseRevenue,
        (n) => fmtCurrency(n, currencySymbol),
      ),
      metricCard(
        "transactions",
        "Transactions",
        fmtInt(current.transactions),
        previous?.transactions,
        current.transactions,
        fmtInt,
      ),
      metricCard(
        "aov",
        "Avg Order Value",
        current.transactions > 0 ? fmtCurrency(current.purchaseRevenue / current.transactions, currencySymbol) : "—",
      ),
      metricCard(
        "conversionRate",
        "Conversion Rate",
        current.sessions > 0 ? fmtPct(current.conversions / current.sessions) : "0.0%",
        previous && previous.sessions > 0 ? previous.conversions / previous.sessions : undefined,
        current.sessions > 0 ? current.conversions / current.sessions : 0,
        fmtPct,
      ),
    );
  } else if (clientKind === "lead_gen") {
    conversionMetrics.push(
      metricCard(
        "conversions",
        "Conversions",
        fmtInt(current.conversions),
        previous?.conversions,
        current.conversions,
        fmtInt,
      ),
      metricCard(
        "conversionRate",
        "Conversion Rate",
        current.sessions > 0 ? fmtPct(current.conversions / current.sessions) : "0.0%",
        previous && previous.sessions > 0 ? previous.conversions / previous.sessions : undefined,
        current.sessions > 0 ? current.conversions / current.sessions : 0,
        fmtPct,
      ),
      metricCard(
        "pagesPerSession",
        "Pages / Session",
        current.sessions > 0 ? (current.screenPageViews / current.sessions).toFixed(1) : "0.0",
      ),
      metricCard(
        "engagementRate",
        "Engagement Rate",
        fmtPct(current.engagementRate),
        previous?.engagementRate,
        current.engagementRate,
        fmtPct,
      ),
    );
  } else if (clientKind === "saas") {
    conversionMetrics.push(
      metricCard(
        "conversions",
        "Sign-ups / Key Events",
        fmtInt(current.conversions),
        previous?.conversions,
        current.conversions,
        fmtInt,
      ),
      metricCard(
        "conversionRate",
        "Conversion Rate",
        current.sessions > 0 ? fmtPct(current.conversions / current.sessions) : "0.0%",
        previous && previous.sessions > 0 ? previous.conversions / previous.sessions : undefined,
        current.sessions > 0 ? current.conversions / current.sessions : 0,
        fmtPct,
      ),
      metricCard(
        "newUsers",
        "New Users",
        fmtInt(current.newUsers),
        previous?.newUsers,
        current.newUsers,
        fmtInt,
      ),
      metricCard(
        "engagementRate",
        "Engagement Rate",
        fmtPct(current.engagementRate),
        previous?.engagementRate,
        current.engagementRate,
        fmtPct,
      ),
    );
  } else {
    conversionMetrics.push(
      metricCard(
        "pageViews",
        "Page Views",
        fmtInt(current.screenPageViews),
        previous?.screenPageViews,
        current.screenPageViews,
        fmtInt,
      ),
      metricCard(
        "pagesPerSession",
        "Pages / Session",
        current.sessions > 0 ? (current.screenPageViews / current.sessions).toFixed(1) : "0.0",
      ),
      metricCard(
        "engagementRate",
        "Engagement Rate",
        fmtPct(current.engagementRate),
        previous?.engagementRate,
        current.engagementRate,
        fmtPct,
      ),
      metricCard(
        "avgEngagementTime",
        "Avg Engagement Time",
        fmtDuration(current.userEngagementDuration / Math.max(current.sessions, 1)),
      ),
    );
  }

  const demographicsNote = breakdowns?.demographics
    ? "Demographics require Google Signals in GA4 and sufficient traffic. Small sites often show mostly Unknown."
    : undefined;

  return {
    version: 1,
    kind: "website",
    propertyId: input.propertyId,
    propertyName: input.propertyName,
    accountName: input.accountName ?? "",
    dateRangeLabel: input.dateRangeLabel,
    comparisonRangeLabel: input.comparisonRangeLabel,
    currencySymbol,
    clientKind,
    overviewMetrics,
    conversionMetrics,
    channels: input.channels.map((c) => ({
      channel: c.channel,
      sessions: c.sessions,
      sessionsLabel: fmtInt(c.sessions),
      engagementRate: c.engagementRate,
      engagementRateLabel: fmtPct(c.engagementRate),
      conversions: c.conversions,
      conversionsLabel: fmtInt(c.conversions),
    })),
    devices: (input.devices ?? []).map((d) => ({
      device: d.device,
      sessions: d.sessions,
      sessionsLabel: fmtInt(d.sessions),
      engagementRate: d.engagementRate,
      engagementRateLabel: fmtPct(d.engagementRate),
      conversions: d.conversions,
      conversionsLabel: fmtInt(d.conversions),
    })),
    geoCities: mapGeoRows(input.geoLocations ?? [], totalSessions),
    geoDimension: input.geoDimension ?? "city",
    campaigns: (input.campaigns ?? []).map((c) => ({
      campaign: c.campaign,
      sessions: c.sessions,
      sessionsLabel: fmtInt(c.sessions),
      engagementRate: c.engagementRate,
      engagementRateLabel: fmtPct(c.engagementRate),
      conversions: c.conversions,
      conversionsLabel: fmtInt(c.conversions),
    })),
    sources: (input.sources ?? []).map((s) => ({
      source: s.source,
      medium: s.medium,
      label: `${s.source} / ${s.medium}`,
      sessions: s.sessions,
      sessionsLabel: fmtInt(s.sessions),
      engagementRate: s.engagementRate,
      engagementRateLabel: fmtPct(s.engagementRate),
      conversions: s.conversions,
      conversionsLabel: fmtInt(s.conversions),
    })),
    ageGroups: mapDemographicRows(input.ageGroups ?? []),
    genders: mapDemographicRows(input.genders ?? []),
    audience: (input.audience ?? []).map((a) => ({
      segment: a.segment,
      sessions: a.sessions,
      sessionsLabel: fmtInt(a.sessions),
      engagementRate: a.engagementRate,
      engagementRateLabel: fmtPct(a.engagementRate),
      conversions: a.conversions,
      conversionsLabel: fmtInt(a.conversions),
    })),
    operatingSystems: (input.operatingSystems ?? []).map((t) => ({
      name: t.name,
      sessions: t.sessions,
      sessionsLabel: fmtInt(t.sessions),
      engagementRate: t.engagementRate,
      engagementRateLabel: fmtPct(t.engagementRate),
      conversions: t.conversions,
      conversionsLabel: fmtInt(t.conversions),
    })),
    browsers: (input.browsers ?? []).map((t) => ({
      name: t.name,
      sessions: t.sessions,
      sessionsLabel: fmtInt(t.sessions),
      engagementRate: t.engagementRate,
      engagementRateLabel: fmtPct(t.engagementRate),
      conversions: t.conversions,
      conversionsLabel: fmtInt(t.conversions),
    })),
    topPages: input.topPages.map((p) => ({
      page: p.page,
      sessions: p.sessions,
      sessionsLabel: fmtInt(p.sessions),
      engagementRate: p.engagementRate,
      engagementRateLabel: fmtPct(p.engagementRate),
    })),
    dayOfWeek: (input.dayOfWeek ?? []).map((t) => ({
      label: t.label,
      sessions: t.sessions,
      sessionsLabel: fmtInt(t.sessions),
      engagementRate: t.engagementRate,
      engagementRateLabel: fmtPct(t.engagementRate),
      conversions: t.conversions,
      conversionsLabel: fmtInt(t.conversions),
      conversionRateLabel: t.sessions > 0 ? fmtPct(t.conversions / t.sessions) : "0.0%",
    })),
    hourOfDay: (input.hourOfDay ?? []).map((t) => ({
      label: t.label,
      sessions: t.sessions,
      sessionsLabel: fmtInt(t.sessions),
      engagementRate: t.engagementRate,
      engagementRateLabel: fmtPct(t.engagementRate),
      conversions: t.conversions,
      conversionsLabel: fmtInt(t.conversions),
      conversionRateLabel: t.sessions > 0 ? fmtPct(t.conversions / t.sessions) : "0.0%",
    })),
    conversionEvents: (input.conversionEvents ?? []).map((e) => ({
      event: e.event,
      count: e.count,
      countLabel: fmtInt(e.count),
      sessions: e.sessions,
      sessionsLabel: fmtInt(e.sessions),
      conversionRateLabel: fmtPct(e.conversionRate),
    })),
    breakdowns: breakdowns ?? {
      device: true,
      geo: true,
      geoDimension: "city",
      channels: true,
      campaigns: false,
      sources: false,
      demographics: false,
      operatingSystem: false,
      browser: false,
      topPages: true,
      newVsReturning: false,
      dayOfWeek: false,
      hourOfDay: false,
      conversionEvents: false,
    },
    demographicsNote,
    attributionNote:
      "Website metrics come from Google Analytics 4. Conversion counts may differ from Meta or Google Ads due to different attribution models and tracking methods.",
  };
}
