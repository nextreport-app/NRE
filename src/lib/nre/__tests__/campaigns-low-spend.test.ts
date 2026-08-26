import { describe, expect, it } from "vitest";
import {
  resolveCampaignSelectionWithLowSpend,
  isLowSpendCampaign,
  LOW_SPEND_CAMPAIGN_THRESHOLD,
} from "../campaigns";

describe("resolveCampaignSelectionWithLowSpend", () => {
  const spend = { "Big Co": 500, "Tiny Co": 2, "Medium Co": 45 };

  it("excludes campaigns under the threshold by default", () => {
    const result = resolveCampaignSelectionWithLowSpend(["Big Co", "Tiny Co", "Medium Co"], null, spend);
    expect(result.selectedCampaigns).toEqual(["Big Co", "Medium Co"]);
    expect(result.lowSpendCampaigns).toEqual(["Tiny Co"]);
  });

  it("respects saved deselection memory for campaigns above the threshold", () => {
    const result = resolveCampaignSelectionWithLowSpend(
      ["Big Co", "Tiny Co", "Medium Co"],
      { campaigns: ["Big Co", "Tiny Co", "Medium Co"], deselected: ["Medium Co"] },
      spend,
    );
    expect(result.selectedCampaigns).toEqual(["Big Co"]);
  });

  it("isLowSpendCampaign treats sub-threshold spend as low", () => {
    expect(isLowSpendCampaign("Tiny Co", spend)).toBe(true);
    expect(isLowSpendCampaign("Big Co", spend)).toBe(false);
    expect(LOW_SPEND_CAMPAIGN_THRESHOLD).toBe(10);
  });
});
