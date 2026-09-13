import { describe, expect, it } from "vitest";
import {
  defaultMetricSelectionForCampaign,
  googleComparisonObjectiveTotals,
  googleSlideObjectiveLabels,
  metricsDictionaryPlatform,
  sharePlatformBadge,
  slotAssignmentPlatform,
  usesGoogleSlotEngine,
  usesMetaObjectiveEngine,
} from "../platform-reporting";
import { parseMtdCsvForAdPlatform } from "../tiktok-columns";

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

  it("maps Google campaign types to slot-engine slide labels", () => {
    expect(googleSlideObjectiveLabels("search").resultLabel).toBe("CONVERSIONS");
    expect(googleSlideObjectiveLabels("display").resultLabel).toBe("VIEWABLE IMPR.");
    expect(googleSlideObjectiveLabels("video").costLabel).toBe("AVG. CPV");
  });

  it("exposes distinct share badges per platform", () => {
    expect(sharePlatformBadge("META").label).toBe("META ADS");
    expect(sharePlatformBadge("GOOGLE").label).toBe("GOOGLE ADS");
    expect(sharePlatformBadge("TIKTOK").label).toBe("TIKTOK ADS");
  });

  it("aggregates Google comparison totals from slot-engine metrics", () => {
    const header = "Campaign,Ad group,Day,Cost,Clicks,Impr.,Conversions";
    const lines = [
      header,
      "Shoes,Prospecting,01-08-2026,100,20,1000,5",
      "Shoes,Prospecting,02-08-2026,100,20,1000,3",
    ];
    const { rows } = parseMtdCsvForAdPlatform(Buffer.from(lines.join("\n"), "utf8"), "GOOGLE");
    const totals = googleComparisonObjectiveTotals(rows, "search", 200);
    expect(totals.count).toBe(8);
    expect(totals.cpr).toBe(25);
  });
});
