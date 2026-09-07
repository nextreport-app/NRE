/**
 * Share-page JSON for Website Traffic (GA4) reports — stored in Report.summaryJson.
 */

import { DEFAULT_WEBSITE_BREAKDOWNS, normalizeBreakdowns, type WebsiteBreakdownOptions, type WebsiteGeoDimension } from "./website-report-config";
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

export interface ShareWebsiteCampaignRow {
  campaign: string;
  sessionsLabel: string;
  engagementRateLabel: string;
  conversionsLabel: string;
}

export interface ShareWebsiteSourceRow {
  label: string;
  sessionsLabel: string;
  engagementRateLabel: string;
  conversionsLabel: string;
}

export interface ShareWebsiteDemographicRow {
  segment: string;
  sessionsLabel: string;
  conversionsLabel: string;
  conversionRateLabel: string;
}

export interface ShareWebsiteAudienceRow {
  segment: string;
  sessionsLabel: string;
  engagementRateLabel: string;
  conversionsLabel: string;
}

export interface ShareWebsiteTechRow {
  name: string;
  sessionsLabel: string;
  engagementRateLabel: string;
  conversionsLabel: string;
}

export interface ShareWebsiteTimeRow {
  label: string;
  sessionsLabel: string;
  engagementRateLabel: string;
  conversionsLabel: string;
  conversionRateLabel: string;
}

export interface ShareWebsiteConversionEventRow {
  event: string;
  countLabel: string;
  sessionsLabel: string;
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
  geoDimension?: WebsiteGeoDimension;
  campaigns?: ShareWebsiteCampaignRow[];
  sources?: ShareWebsiteSourceRow[];
  ageGroups?: ShareWebsiteDemographicRow[];
  genders?: ShareWebsiteDemographicRow[];
  audience?: ShareWebsiteAudienceRow[];
  operatingSystems?: ShareWebsiteTechRow[];
  browsers?: ShareWebsiteTechRow[];
  dayOfWeek?: ShareWebsiteTimeRow[];
  hourOfDay?: ShareWebsiteTimeRow[];
  conversionEvents?: ShareWebsiteConversionEventRow[];
  topPages: ShareWebsitePageRow[];
  breakdowns?: WebsiteBreakdownOptions & { geoCities?: boolean };
  demographicsNote?: string;
  attributionNote: string;
  agencyName?: string | null;
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
    devices: data.devices.map((d) => ({
      device: d.device,
      sessionsLabel: d.sessionsLabel,
      engagementRateLabel: d.engagementRateLabel,
      conversionsLabel: d.conversionsLabel,
    })),
    geoCities: data.geoCities.map((g) => ({
      location: g.location,
      sessionsLabel: g.sessionsLabel,
      shareLabel: g.shareLabel,
      conversionsLabel: g.conversionsLabel,
      conversionRateLabel: g.conversionRateLabel,
    })),
    geoDimension: data.geoDimension,
    campaigns: data.campaigns.map((c) => ({
      campaign: c.campaign,
      sessionsLabel: c.sessionsLabel,
      engagementRateLabel: c.engagementRateLabel,
      conversionsLabel: c.conversionsLabel,
    })),
    sources: data.sources.map((s) => ({
      label: s.label,
      sessionsLabel: s.sessionsLabel,
      engagementRateLabel: s.engagementRateLabel,
      conversionsLabel: s.conversionsLabel,
    })),
    ageGroups: data.ageGroups.map((a) => ({
      segment: a.segment,
      sessionsLabel: a.sessionsLabel,
      conversionsLabel: a.conversionsLabel,
      conversionRateLabel: a.conversionRateLabel,
    })),
    genders: data.genders.map((g) => ({
      segment: g.segment,
      sessionsLabel: g.sessionsLabel,
      conversionsLabel: g.conversionsLabel,
      conversionRateLabel: g.conversionRateLabel,
    })),
    audience: data.audience.map((a) => ({
      segment: a.segment,
      sessionsLabel: a.sessionsLabel,
      engagementRateLabel: a.engagementRateLabel,
      conversionsLabel: a.conversionsLabel,
    })),
    operatingSystems: data.operatingSystems.map((t) => ({
      name: t.name,
      sessionsLabel: t.sessionsLabel,
      engagementRateLabel: t.engagementRateLabel,
      conversionsLabel: t.conversionsLabel,
    })),
    browsers: data.browsers.map((t) => ({
      name: t.name,
      sessionsLabel: t.sessionsLabel,
      engagementRateLabel: t.engagementRateLabel,
      conversionsLabel: t.conversionsLabel,
    })),
    dayOfWeek: data.dayOfWeek.map((t) => ({
      label: t.label,
      sessionsLabel: t.sessionsLabel,
      engagementRateLabel: t.engagementRateLabel,
      conversionsLabel: t.conversionsLabel,
      conversionRateLabel: t.conversionRateLabel,
    })),
    hourOfDay: data.hourOfDay.map((t) => ({
      label: t.label,
      sessionsLabel: t.sessionsLabel,
      engagementRateLabel: t.engagementRateLabel,
      conversionsLabel: t.conversionsLabel,
      conversionRateLabel: t.conversionRateLabel,
    })),
    conversionEvents: data.conversionEvents.map((e) => ({
      event: e.event,
      countLabel: e.countLabel,
      sessionsLabel: e.sessionsLabel,
      conversionRateLabel: e.conversionRateLabel,
    })),
    topPages: data.topPages.map((p) => ({
      page: p.page,
      sessionsLabel: p.sessionsLabel,
      engagementRateLabel: p.engagementRateLabel,
    })),
    breakdowns: data.breakdowns,
    demographicsNote: data.demographicsNote,
    attributionNote: data.attributionNote,
    agencyName: options.agencyName ?? null,
    publishedAt: null,
  };
}

export function shareBreakdowns(data: ShareWebsiteReportData) {
  if (data.breakdowns) return normalizeBreakdowns(data.breakdowns);
  return { ...DEFAULT_WEBSITE_BREAKDOWNS, geo: false, campaigns: false, sources: false, demographics: false, operatingSystem: false, browser: false, newVsReturning: false, dayOfWeek: false, hourOfDay: false, conversionEvents: false };
}

export function isShareWebsiteReportData(value: unknown): value is ShareWebsiteReportData {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as ShareWebsiteReportData).version === 1 &&
    (value as ShareWebsiteReportData).kind === "website"
  );
}
