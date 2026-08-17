import { describe, expect, it } from "vitest";
import { buildGoogleAdsInsightPrompt, buildGoogleAdsSummaryPrompt } from "../google-prompts";
import type { AiContext } from "../../nre/report-data";

const ctx: AiContext = {
  ctx: "Shoes - Search",
  dateRange: "July 13 - July 19",
  spend: "$100",
  reach: "40",
  impressions: "2,000",
  results: "6",
  cpr: "$16.67",
  ctr: "2%",
  cpc: "$2.50",
  cpm: "$50.00",
  resultLabel: "CONVERSIONS",
  costLabel: "COST PER CONVERSION",
  freq: 0,
  resultsNum: 6,
  hasResults: true,
  spendNum: 100,
  isInactive: false,
};

describe("buildGoogleAdsSummaryPrompt", () => {
  it("never mentions Meta Ads (Fix 3 dropped the platform-name framing sentence entirely)", () => {
    const prompt = buildGoogleAdsSummaryPrompt(ctx);
    expect(prompt).not.toContain("Meta Ads");
  });

  it("does not start with the date/campaign name — Fix 3's 'already shown on the slide' instruction", () => {
    const prompt = buildGoogleAdsSummaryPrompt(ctx);
    expect(prompt).toContain("Do NOT start with the date range or campaign name — those are already shown on the slide.");
    expect(prompt).toContain("Never start with During [date] or The [campaign name] campaign");
  });

  it("carries the real numbers through as Cost/Clicks/Conversions/Cost per conversion/CTR/Avg. CPC", () => {
    const prompt = buildGoogleAdsSummaryPrompt(ctx);
    expect(prompt).toContain("Cost: $100");
    expect(prompt).toContain("Clicks: 40");
    expect(prompt).toContain("Conversions: 6");
    expect(prompt).toContain("Cost per conversion: $16.67");
    expect(prompt).toContain("CTR: 2%");
    expect(prompt).toContain("Avg. CPC: $2.50");
  });
});

describe("buildGoogleAdsInsightPrompt", () => {
  it("mentions Google Ads and asks for exactly 3 sentences, same structure as Meta's", () => {
    const prompt = buildGoogleAdsInsightPrompt(ctx);
    expect(prompt).toContain("Google Ads");
    expect(prompt).toContain("exactly 3 sentences");
    expect(prompt).toContain("Sentence 3");
  });
});
