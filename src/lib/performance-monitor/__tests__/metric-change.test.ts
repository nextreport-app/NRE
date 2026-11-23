import { describe, expect, it } from "vitest";
import { metricChange } from "../metric-change";
describe("dashboard comparison direction", () => {
  it("marks a CPC/CPL increase as unfavorable and decrease as favorable", () => {
    expect(metricChange(12, 10, "lower")).toEqual({
      label: "+20%",
      tone: "negative",
    });
    expect(metricChange(8, 10, "lower")).toEqual({
      label: "−20%",
      tone: "positive",
    });
  });
  it("marks CTR/ROAS increases as favorable", () => {
    expect(metricChange(3, 2, "higher")).toEqual({
      label: "+50%",
      tone: "positive",
    });
    expect(metricChange(1, 2, "higher").tone).toBe("negative");
  });
  it("keeps spend and delivery volume neutral", () =>
    expect(metricChange(200, 100, "neutral").tone).toBe("neutral"));
  it("does not invent percentages or success from missing and zero baselines", () => {
    expect(metricChange(10, 0, "higher")).toEqual({
      label: "New · no baseline",
      tone: "neutral",
    });
    expect(metricChange(null, 10, "lower").tone).toBe("neutral");
    expect(metricChange(0, 0, "higher").label).toBe("No change");
    expect(metricChange(NaN, 10, "lower").label).toBe("Unavailable");
  });
  it("keeps stale comparisons and rounded unchanged values neutral", () => {
    expect(metricChange(1, 2, "lower", false).tone).toBe("neutral");
    expect(metricChange(1.0001, 1, "higher")).toEqual({
      label: "No change",
      tone: "neutral",
    });
    expect(metricChange(0, 5, "higher")).toEqual({
      label: "−100%",
      tone: "negative",
    });
  });
});
