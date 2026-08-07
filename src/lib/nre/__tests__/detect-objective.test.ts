import { describe, it, expect } from "vitest";
import { detectGoogleObjectiveKey } from "../detect-objective";

describe("detectGoogleObjectiveKey", () => {
  it("classifies a shopping/Performance Max CSV as 'shopping'", () => {
    expect(detectGoogleObjectiveKey(["campaign", "orders", "conv. value / cost"])).toBe("shopping");
  });

  it("classifies a video/YouTube CSV as 'video'", () => {
    expect(detectGoogleObjectiveKey(["campaign", "trueview views", "trueview avg. cpv"])).toBe("video");
  });

  it("classifies a Demand Gen engagement CSV as 'demand_gen'", () => {
    expect(detectGoogleObjectiveKey(["campaign", "engagements", "engagement rate"])).toBe("demand_gen");
  });

  it("classifies a Display viewability CSV as 'display'", () => {
    expect(detectGoogleObjectiveKey(["campaign", "viewable impr.", "viewable rate"])).toBe("display");
  });

  it("classifies a store-visits CSV as 'local'", () => {
    expect(detectGoogleObjectiveKey(["campaign", "store visits"])).toBe("local");
  });

  it("defaults to 'search' for a plain Search Ads CSV", () => {
    expect(detectGoogleObjectiveKey(["campaign", "cost", "clicks", "impr.", "avg. cpc"])).toBe("search");
  });
});
