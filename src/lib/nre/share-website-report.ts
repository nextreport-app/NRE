/**
 * Share-page JSON for Website Traffic (GA4) reports — stored in Report.summaryJson.
 */

import type { WebsiteReportData } from "./website-report-data";

export interface ShareWebsiteMetricCard {
  label: string;
  value: string;
  changeLabel?: string;
}

export interface ShareWebsiteChannelRow {
  channel: string;
  sessionsLabel: string;
  engagementRateLabel: string;
  conversionsLabel: string;
}

export interface ShareWebsitePageRow {
  page: string;
  sessionsLabel: string;
  engagementRateLabel: string;
}

export interface ShareWebsiteReportData {
  version: 1;
  kind: "website";
  accountName: string;
  propertyName: string;
  dateRangeLabel: string;
  comparisonRangeLabel?: string;
  clientKind: WebsiteReportData["clientKind"];
  overviewMetrics: ShareWebsiteMetricCard[];
  conversionMetrics: ShareWebsiteMetricCard[];
  channels: ShareWebsiteChannelRow[];
  topPages: ShareWebsitePageRow[];
  attributionNote: string;
  agencyName?: string | null;
  /** ISO timestamp when the agency published the share link */
  publishedAt?: string | null;
}

export function buildShareWebsiteReportData(
  data: WebsiteReportData,
  options: { agencyName?: string | null; accountName?: string } = {},
): ShareWebsiteReportData {
  const mapCard = (c: WebsiteReportData["overviewMetrics"][number]): ShareWebsiteMetricCard => ({
    label: c.label,
    value: c.value,
    changeLabel: c.changeLabel,
  });

  return {
    version: 1,
    kind: "website",
    accountName: options.accountName ?? data.propertyName,
    propertyName: data.propertyName,
    dateRangeLabel: data.dateRangeLabel,
    comparisonRangeLabel: data.comparisonRangeLabel,
    clientKind: data.clientKind,
    overviewMetrics: data.overviewMetrics.map(mapCard),
    conversionMetrics: data.conversionMetrics.map(mapCard),
    channels: data.channels.map((c) => ({
      channel: c.channel,
      sessionsLabel: c.sessionsLabel,
      engagementRateLabel: c.engagementRateLabel,
      conversionsLabel: c.conversionsLabel,
    })),
    topPages: data.topPages.map((p) => ({
      page: p.page,
      sessionsLabel: p.sessionsLabel,
      engagementRateLabel: p.engagementRateLabel,
    })),
    attributionNote: data.attributionNote,
    agencyName: options.agencyName ?? null,
    publishedAt: null,
  };
}

export function isShareWebsiteReportData(value: unknown): value is ShareWebsiteReportData {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as ShareWebsiteReportData).version === 1 &&
    (value as ShareWebsiteReportData).kind === "website"
  );
}
