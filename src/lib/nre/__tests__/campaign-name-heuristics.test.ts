import { describe, expect, it } from "vitest";
import {
  campaignNameHaystack,
  isQuoteRequestCampaignHaystack,
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
});
