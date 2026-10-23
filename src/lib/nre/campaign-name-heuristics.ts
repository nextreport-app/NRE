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

/** Meta instant-form lead campaigns — InstantForms, LeadGen, Leads (form), etc. */
export function isMetaFormLeadsCampaignHaystack(haystack: string): boolean {
  return (
    /instant.?form|instantforms|meta.?form|lead.?form|leadgen|leads?\s*\(\s*form/.test(haystack) ||
    // "Form Leads Campaign" / "Leads Form" naming — must beat generic \bleads\b website heuristic.
    /\bform[\s_\-]?leads?\b|\bleads?[\s_\-]?form\b/.test(haystack) ||
    // "Meta Leads Campaign" — on-platform instant/form leads, not website leads.
    /\bmeta[\s_\-]?leads?\b/.test(haystack)
  );
}

const TRAFFIC_CAMPAIGN_NAME =
  /(?:^|[\s_\-])traffic(?:[\s_\-]|$)|_traffic_/;

/** Traffic / link-click campaigns — excludes reach, website-leads, and instant-form naming. */
export function isLinkClicksCampaignHaystack(haystack: string): boolean {
  if (isReachCampaignHaystack(haystack)) return false;
  if (isMetaFormLeadsCampaignHaystack(haystack)) return false;
  const isTrafficNamed = TRAFFIC_CAMPAIGN_NAME.test(haystack);
  // "TRAFFIC - WEBSITE" landing/click campaigns are not website-lead campaigns.
  if (!isTrafficNamed && /website.?lead|web.?lead|_website\b|website_|\bwebsite\b/.test(haystack)) {
    return false;
  }
  if (isTrafficNamed && /website.?lead|web.?lead|_leads\b/.test(haystack)) return false;
  if (/linkclicks|link_clicks/.test(haystack)) return true;
  if (/\blink[\s_\-]?clicks?\b/.test(haystack)) return true;
  // Underscore-safe — JS \b misses Brand_Traffic_LinkClicks-style names.
  return isTrafficNamed;
}

/** Website/offsite lead campaigns — excludes messenger/instant-form/traffic naming. */
export function isWebsiteLeadsCampaignHaystack(haystack: string): boolean {
  if (isMessagingCampaignHaystack(haystack)) return false;
  if (isMetaFormLeadsCampaignHaystack(haystack)) return false;
  if (isLinkClicksCampaignHaystack(haystack)) return false;
  if (/whatsapp/.test(haystack)) return false;
  // Meta/on-platform lead campaigns — not website/offsite leads.
  if (/\bmeta[\s_\-]?leads?\b/.test(haystack)) return false;
  // Do not treat bare "Leads" in names like "New Leads campaign" as website leads —
  // trust Result type / Website leads column instead (Ski Summit instant-form case).
  // Do not treat "TRAFFIC - WEBSITE" as website leads — bare "website" without "lead(s)" is too broad.
  if (TRAFFIC_CAMPAIGN_NAME.test(haystack) && !/website.?lead|web.?lead|_leads\b/.test(haystack)) {
    return false;
  }
  return /website.?lead|web.?lead|_leads\b|_website\b|website_/.test(haystack);
}

export function isQuoteRequestCampaignHaystack(haystack: string): boolean {
  return /quote[\s_]*request/.test(haystack);
}

/** Reach/awareness campaigns — underscore-safe match avoids "outreach"/"breach" false positives. */
export function isReachCampaignHaystack(haystack: string): boolean {
  if (/\bawareness\b/.test(haystack)) return true;
  if (/\breach\b/.test(haystack)) return true;
  // Meta names often use underscores (e.g. Brand_Reach_Retargeting) where \b fails.
  return /(?:^|[\s_\-])reach(?:[\s_\-]|$)/.test(haystack);
}

/** Pipe-delimited Meta campaign names often use a dedicated "| Sales |" objective segment. */
function hasSalesObjectiveNameSegment(haystack: string): boolean {
  return haystack.split("|").some((seg) => seg.trim().toLowerCase() === "sales");
}

/** Purchase/sales campaigns — excludes funnels explicitly named for ATC/IC only. */
export function isPurchaseCampaignHaystack(haystack: string): boolean {
  if (/\batc\b|add.?to.?cart/.test(haystack) && !/purchase|purchases|conversion/.test(haystack)) {
    return false;
  }
  if (/\bic\b|initiate.?checkout/.test(haystack) && !/purchase|purchases|conversion/.test(haystack)) {
    return false;
  }
  if (hasSalesObjectiveNameSegment(haystack)) return true;
  if (/purchase|purchases/.test(haystack)) return true;
  // "Leads Conversion" ad set names are lead-gen, not purchase campaigns.
  if (/leads?\s*conversion|conversion\s*leads?/.test(haystack)) return false;
  return /\bconversion\b/.test(haystack);
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

export function isReachCampaignName(rows: MetricRow[]): boolean {
  return isReachCampaignHaystack(campaignNameHaystackFromRows(rows));
}

export function isLinkClicksCampaignName(rows: MetricRow[]): boolean {
  return isLinkClicksCampaignHaystack(campaignNameHaystackFromRows(rows));
}

export function isLeadFamilyCampaignName(rows: MetricRow[]): boolean {
  return isMetaFormLeadsCampaignName(rows) || isWebsiteLeadsCampaignName(rows);
}
