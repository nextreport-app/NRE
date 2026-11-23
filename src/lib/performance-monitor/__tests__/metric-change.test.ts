import { describe, expect, it } from "vitest";
import { metricChange } from "../metric-change";
describe("dashboard comparison direction", () => {
  it("colors increases green and decreases red, including costs", () => {
    expect(metricChange(12, 10, "signed")).toEqual({
      label: "+20%",
      tone: "positive",
    });
    expect(metricChange(8, 10, "signed")).toEqual({
      label: "−20%",
      tone: "negative",
    });
  });
  it("marks CTR/ROAS increases as favorable", () => {
    expect(metricChange(3, 2, "signed")).toEqual({
      label: "+50%",
      tone: "positive",
    });
    expect(metricChange(1, 2, "signed").tone).toBe("negative");
  });
  it("keeps incomparable outcomes neutral", () =>
    expect(metricChange(200, 100, "neutral").tone).toBe("neutral"));
  it("does not invent percentages or success from missing and zero baselines", () => {
    expect(metricChange(10, 0, "signed")).toEqual({
      label: "New · no baseline",
      tone: "neutral",
    });
    expect(metricChange(null, 10, "signed").tone).toBe("neutral");
    expect(metricChange(0, 0, "signed").label).toBe("No change");
    expect(metricChange(NaN, 10, "signed").label).toBe("Unavailable");
  });
  it("keeps stale comparisons and rounded unchanged values neutral", () => {
    expect(metricChange(1, 2, "signed", false).tone).toBe("neutral");
    expect(metricChange(1.0001, 1, "signed")).toEqual({
      label: "No change",
      tone: "neutral",
    });
    expect(metricChange(0, 5, "signed")).toEqual({
      label: "−100%",
      tone: "negative",
    });
  });
});
