/**
 * Share-page JSON for Website Traffic (GA4) reports — stored in Report.summaryJson.
 */

import type { WebsiteBreakdownOptions, WebsiteReportData } from "./website-report-data";
import { DEFAULT_WEBSITE_BREAKDOWNS } from "./website-report-data";

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

export interface ShareWebsiteDeviceRow {
  device: string;
  sessionsLabel: string;
  engagementRateLabel: string;
  conversionsLabel: string;
}

export interface ShareWebsiteGeoRow {
  location: string;
  sessionsLabel: string;
  shareLabel: string;
  conversionsLabel: string;
  conversionRateLabel: string;
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
  devices?: ShareWebsiteDeviceRow[];
  geoCities?: ShareWebsiteGeoRow[];
  topPages: ShareWebsitePageRow[];
  breakdowns?: WebsiteBreakdownOptions;
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
    devices: (data.devices ?? []).map((d) => ({
      device: d.device,
      sessionsLabel: d.sessionsLabel,
      engagementRateLabel: d.engagementRateLabel,
      conversionsLabel: d.conversionsLabel,
    })),
    geoCities: (data.geoCities ?? []).map((g) => ({
      location: g.location,
      sessionsLabel: g.sessionsLabel,
      shareLabel: g.shareLabel,
      conversionsLabel: g.conversionsLabel,
      conversionRateLabel: g.conversionRateLabel,
    })),
    topPages: data.topPages.map((p) => ({
      page: p.page,
      sessionsLabel: p.sessionsLabel,
      engagementRateLabel: p.engagementRateLabel,
    })),
    breakdowns: data.breakdowns ?? DEFAULT_WEBSITE_BREAKDOWNS,
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
