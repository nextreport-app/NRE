import { describe, expect, it } from "vitest";
import {
  buildGoogleCampaignTypeMap,
  detectGoogleObjectiveFromCampaignRawRows,
  detectGoogleObjectiveFromHeaders,
  detectGoogleObjectiveKey,
  googleObjectiveSpecForKey,
} from "../google-objective-dictionary";

describe("google-objective-dictionary", () => {
  it("classifies campaign types from CSV headers", () => {
    expect(detectGoogleObjectiveKey(["campaign", "orders", "conv. value / cost"])).toBe("shopping");
    expect(detectGoogleObjectiveKey(["campaign", "trueview views", "trueview avg. cpv"])).toBe("video");
    expect(detectGoogleObjectiveKey(["campaign", "engagements", "engagement rate"])).toBe("demand_gen");
    expect(detectGoogleObjectiveKey(["campaign", "viewable impr.", "viewable rate"])).toBe("display");
    expect(detectGoogleObjectiveKey(["campaign", "store visits"])).toBe("local");
    expect(detectGoogleObjectiveKey(["campaign", "cost", "clicks", "impr.", "avg. cpc"])).toBe("search");
  });

  it("exposes slide labels and slot keys from one spec", () => {
    const shopping = googleObjectiveSpecForKey("shopping");
    expect(shopping.resultLabel).toBe("CONV. VALUE");
    expect(shopping.costLabel).toBe("ROAS");
    expect(shopping.slot4MetricKey).toBe("conv_value");
    expect(shopping.slot5MetricKey).toBe("roas");

    const search = detectGoogleObjectiveFromHeaders(["campaign", "clicks"]);
    expect(search.key).toBe("search");
    expect(search.slot4MetricKey).toBe("conversions");
  });

  it("detects per-campaign type in mixed exports from active columns", () => {
    const fileHeaders = [
      "Campaign",
      "Cost",
      "Clicks",
      "Impr.",
      "Conversions",
      "Orders",
      "Conv. value / cost",
    ];

    const searchRows = [
      { _raw: { Campaign: "Search Brand", Cost: "50", Clicks: "120", "Impr.": "5000", Conversions: "8" } },
      { _raw: { Campaign: "Search Brand", Cost: "45", Clicks: "100", "Impr.": "4800", Conversions: "6" } },
    ];
    const shoppingRows = [
      {
        _raw: {
          Campaign: "Shopping PMax",
          Cost: "200",
          Clicks: "80",
          "Impr.": "12000",
          Conversions: "0",
          Orders: "15",
          "Conv. value / cost": "3.2",
        },
      },
      {
        _raw: {
          Campaign: "Shopping PMax",
          Cost: "180",
          Clicks: "70",
          "Impr.": "11000",
          Conversions: "0",
          Orders: "12",
          "Conv. value / cost": "2.9",
        },
      },
    ];

    expect(detectGoogleObjectiveFromCampaignRawRows(searchRows, fileHeaders)).toBe("search");
    expect(detectGoogleObjectiveFromCampaignRawRows(shoppingRows, fileHeaders)).toBe("shopping");

    const typeMap = buildGoogleCampaignTypeMap(
      { "Search Brand": searchRows, "Shopping PMax": shoppingRows },
      fileHeaders,
    );
    expect(typeMap.get("Search Brand")).toBe("search");
    expect(typeMap.get("Shopping PMax")).toBe("shopping");
  });
});
