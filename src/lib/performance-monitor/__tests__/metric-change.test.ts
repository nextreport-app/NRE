import { describe, expect, it } from "vitest";
import { metricChange } from "../metric-change";
describe("dashboard uses comparison-report metric semantics", () => {
  it("marks lower costs green and higher costs red without changing the numeric sign", () => {
    for (const [key, label] of [
      ["cpc_link", "CPC (cost per link click)"],
      ["cpm", "CPM"],
      ["cpr", "Cost per lead"],
      ["cost_per_custom_event", "Cost per install"],
    ]) {
      expect(metricChange(8.87, 9.01, key, label)).toEqual({
        label: "−1.6%",
        tone: "positive",
      });
      expect(metricChange(12, 10, key, label)).toEqual({
        label: "+20%",
        tone: "negative",
      });
    }
  });
  it("marks higher results, CTR, reach and ROAS green and declines red", () => {
    for (const key of [
      "results",
      "ctr",
      "reach",
      "impressions",
      "link_clicks",
      "roas",
      "conversions_add_to_cart",
    ]) {
      expect(metricChange(3, 2, key, key).tone).toBe("positive");
      expect(metricChange(1, 2, key, key).tone).toBe("negative");
    }
  });
  it("keeps spend and stale or incomparable observations neutral", () => {
    expect(metricChange(200, 100, "spend", "Amount spent").tone).toBe(
      "neutral",
    );
    expect(metricChange(1, 2, "cpc", "CPC", false).tone).toBe("neutral");
  });
  it("preserves missing observations and zero baselines", () => {
    expect(metricChange(10, 0, "results", "Results")).toEqual({
      label: "New · no baseline",
      tone: "neutral",
    });
    expect(metricChange(null, 10, "cpr", "CPL").label).toBe("Unavailable");
    expect(metricChange(0, 0, "results", "Results").label).toBe("No change");
    expect(metricChange(NaN, 10, "cpc", "CPC").label).toBe("Unavailable");
  });
  it("does not round small real changes to no change", () => {
    expect(metricChange(1.0001, 1, "results", "Results")).toEqual({
      label: "+<0.1%",
      tone: "positive",
    });
    expect(metricChange(0, 5, "results", "Results")).toEqual({
      label: "−100%",
      tone: "negative",
    });
  });
});
