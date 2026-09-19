/**
 * Shared campaign/ad-set naming heuristics — single source of truth for
 * objective detection in manual CSV (objective.ts) and API sync
 * (fetch-meta-report-rows.ts). Keeps quote vs website-leads vs messaging
 * disambiguation aligned across both ingestion paths.
 */

import type { MetricRow } from "./types";

export function campaignNameHaystack(campaignName?: string | null, adSetName?: string | null): string {
  return `${campaignName ?? ""} ${adSetName ?? ""}`.toLowerCase();
}

export function campaignNameHaystackFromRows(rows: MetricRow[]): string {
  return rows.map((r) => `${r.campaign_name ?? ""} ${r.ad_set_name ?? ""}`).join(" ").toLowerCase();
}

export function isMessagingCampaignHaystack(haystack: string): boolean {
  return /messag|messenger/.test(haystack);
}

/** Meta instant-form lead campaigns — InstantForms, Leads (form), etc. */
export function isMetaFormLeadsCampaignHaystack(haystack: string): boolean {
  return /instant.?form|instantforms|meta.?form|lead.?form|leads?\s*\(\s*form/.test(haystack);
}

/** Website/offsite lead campaigns — excludes messenger/instant-form naming. */
export function isWebsiteLeadsCampaignHaystack(haystack: string): boolean {
  if (isMessagingCampaignHaystack(haystack)) return false;
  if (isMetaFormLeadsCampaignHaystack(haystack)) return false;
  if (/whatsapp/.test(haystack)) return false;
  return /website.?lead|web.?lead|_leads\b|\bleads\b|_website\b|website_|\bwebsite\b/.test(haystack);
}

export function isQuoteRequestCampaignHaystack(haystack: string): boolean {
  return /quote[\s_]*request/.test(haystack);
}

/** Purchase/sales campaigns — excludes funnels explicitly named for ATC/IC only. */
export function isPurchaseCampaignHaystack(haystack: string): boolean {
  if (/\batc\b|add.?to.?cart/.test(haystack) && !/purchase|purchases|conversion/.test(haystack)) {
    return false;
  }
  if (/\bic\b|initiate.?checkout/.test(haystack) && !/purchase|purchases|conversion/.test(haystack)) {
    return false;
  }
  return /purchase|purchases|conversion/.test(haystack);
}

export function isMessagingCampaignName(rows: MetricRow[]): boolean {
  return isMessagingCampaignHaystack(campaignNameHaystackFromRows(rows));
}

export function isMetaFormLeadsCampaignName(rows: MetricRow[]): boolean {
  return isMetaFormLeadsCampaignHaystack(campaignNameHaystackFromRows(rows));
}

export function isWebsiteLeadsCampaignName(rows: MetricRow[]): boolean {
  return isWebsiteLeadsCampaignHaystack(campaignNameHaystackFromRows(rows));
}

export function isQuoteRequestCampaignName(rows: MetricRow[]): boolean {
  return isQuoteRequestCampaignHaystack(campaignNameHaystackFromRows(rows));
}

export function isPurchaseCampaignName(rows: MetricRow[]): boolean {
  return isPurchaseCampaignHaystack(campaignNameHaystackFromRows(rows));
}

export function isLeadFamilyCampaignName(rows: MetricRow[]): boolean {
  return isMetaFormLeadsCampaignName(rows) || isWebsiteLeadsCampaignName(rows);
}
