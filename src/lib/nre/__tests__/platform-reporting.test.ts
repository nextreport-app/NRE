import { describe, expect, it } from "vitest";
import {
  defaultMetricSelectionForCampaign,
  metricsDictionaryPlatform,
  sharePlatformBadge,
  slotAssignmentPlatform,
  usesGoogleSlotEngine,
  usesMetaObjectiveEngine,
} from "../platform-reporting";

describe("platform-reporting", () => {
  it("routes TikTok through the Meta metric dictionary and slot engine", () => {
    expect(metricsDictionaryPlatform("TIKTOK")).toBe("META");
    expect(slotAssignmentPlatform("TIKTOK")).toBe("meta");
    expect(usesGoogleSlotEngine("TIKTOK")).toBe(false);
    expect(usesMetaObjectiveEngine("TIKTOK")).toBe(true);
  });

  it("routes Google through the Google dictionary and slot engine", () => {
    expect(metricsDictionaryPlatform("GOOGLE")).toBe("GOOGLE");
    expect(slotAssignmentPlatform("GOOGLE")).toBe("google");
    expect(usesGoogleSlotEngine("GOOGLE")).toBe(true);
    expect(usesMetaObjectiveEngine("GOOGLE")).toBe(false);
  });

  it("uses Google default metric selection for Google platform", () => {
    const headers = ["Campaign", "Cost", "Clicks", "Impressions", "Conversions", "Cost / conv."];
    const selection = defaultMetricSelectionForCampaign("GOOGLE", {
      resultLabel: "CONVERSIONS",
      costLabel: "COST PER CONVERSION",
      headers,
      googleObjectiveKey: "search",
    });
    expect(selection).toHaveLength(8);
    expect(selection.some((m) => m.key === "conversions")).toBe(true);
  });

  it("exposes distinct share badges per platform", () => {
    expect(sharePlatformBadge("META").label).toBe("META ADS");
    expect(sharePlatformBadge("GOOGLE").label).toBe("GOOGLE ADS");
    expect(sharePlatformBadge("TIKTOK").label).toBe("TIKTOK ADS");
  });
});
