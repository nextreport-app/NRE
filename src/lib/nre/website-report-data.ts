/**
 * Website Traffic report data — separate from Meta/Google Ads ReportData.
 *
 * Slide plan (Phase 1):
 * 1. Traffic overview — 8 metric cards
 * 2. Conversions / ecommerce — objective-specific cards
 * 3. Traffic sources table — channel breakdown
 * 4. Top pages table (optional)
 */

export type WebsiteClientKind = "lead_gen" | "ecommerce" | "content";

export interface WebsiteMetricCard {
  key: string;
  label: string;
  value: string;
  previousValue?: string;
  /** e.g. "+12.4%" or "−3.1%" — empty when no comparison */
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
  topPages: WebsitePageRow[];
  /** Shown on cover / footnote — GA4 attribution differs from ad platforms */
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

export function buildWebsiteReportData(input: {
  propertyId: string;
  propertyName: string;
  accountName?: string;
  dateRangeLabel: string;
  comparisonRangeLabel?: string;
  currencySymbol: string;
  current: Ga4OverviewTotals;
  previous?: Ga4OverviewTotals;
  channels: Array<{ channel: string; sessions: number; engagementRate: number; conversions: number }>;
  topPages: Array<{ page: string; sessions: number; engagementRate: number }>;
}): WebsiteReportData {
  const { current, previous, currencySymbol } = input;
  const clientKind = detectWebsiteClientKind(current);

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
    topPages: input.topPages.map((p) => ({
      page: p.page,
      sessions: p.sessions,
      sessionsLabel: fmtInt(p.sessions),
      engagementRate: p.engagementRate,
      engagementRateLabel: fmtPct(p.engagementRate),
    })),
    attributionNote:
      "Website metrics come from Google Analytics 4. Conversion counts may differ from Meta or Google Ads due to different attribution models and tracking methods.",
  };
}
