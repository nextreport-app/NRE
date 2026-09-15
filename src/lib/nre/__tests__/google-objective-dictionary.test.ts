import { describe, expect, it } from "vitest";
import {
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
});
