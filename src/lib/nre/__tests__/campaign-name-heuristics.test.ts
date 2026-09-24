import { describe, expect, it } from "vitest";
import {
  campaignNameHaystack,
  isLinkClicksCampaignHaystack,
  isMetaFormLeadsCampaignHaystack,
  isQuoteRequestCampaignHaystack,
  isReachCampaignHaystack,
  isWebsiteLeadsCampaignHaystack,
} from "../campaign-name-heuristics";

describe("campaign-name-heuristics", () => {
  it("website-leads naming does not override quote-request naming", () => {
    const haystack = campaignNameHaystack("Re-Targeting Quote Requests", "Retargeting - Quote Requests");
    expect(isQuoteRequestCampaignHaystack(haystack)).toBe(true);
    expect(isWebsiteLeadsCampaignHaystack(haystack)).toBe(false);
  });

  it("website leads campaigns match website-leads heuristic but not quote", () => {
    const haystack = campaignNameHaystack(
      "Brisbane North - cold traffic - website leads",
      "Brisbane North - cold traffic - website leads - broad",
    );
    expect(isWebsiteLeadsCampaignHaystack(haystack)).toBe(true);
    expect(isQuoteRequestCampaignHaystack(haystack)).toBe(false);
  });

  it("reach campaigns match reach heuristic but not outreach false positives", () => {
    expect(isReachCampaignHaystack(campaignNameHaystack("SouthavenRV_Reach_Retargeting_April 9", ""))).toBe(true);
    expect(isReachCampaignHaystack(campaignNameHaystack("Brand - Reach", "Awareness"))).toBe(true);
    expect(isReachCampaignHaystack(campaignNameHaystack("Outreach_Leads_Campaign", ""))).toBe(false);
    expect(isReachCampaignHaystack(campaignNameHaystack("Breach Protocol Leads", ""))).toBe(false);
  });

  it("Southaven lead gen and traffic naming resolves to meta form vs link clicks, not website leads", () => {
    const leadGen = campaignNameHaystack("SouthavenRV&Marine_LeadGen_InstantForm", "");
    const traffic = campaignNameHaystack("SouthavenRV&Marine_Traffic_LinkClicks", "");
    expect(isMetaFormLeadsCampaignHaystack(leadGen)).toBe(true);
    expect(isLinkClicksCampaignHaystack(traffic)).toBe(true);
    expect(isWebsiteLeadsCampaignHaystack(leadGen)).toBe(false);
    expect(isWebsiteLeadsCampaignHaystack(traffic)).toBe(false);
  });
});
