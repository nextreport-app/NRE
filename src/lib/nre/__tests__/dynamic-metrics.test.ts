import { describe, it, expect } from "vitest";
import { aggregateDynamicMetrics } from "../dynamic-metrics";
import type { SelectedMetric } from "../metric-selector";
import type { NreRow } from "../columns";

function row(raw: Record<string, string>): NreRow {
  return { _raw: raw } as NreRow;
}

function metric(overrides: Partial<SelectedMetric> = {}): SelectedMetric {
  return {
    key: "spend",
    label: "AD SPEND",
    format: "currency",
    type: "primary",
    priority: 100,
    csvName: "amount spent",
    ...overrides,
  };
}

describe("aggregateDynamicMetrics", () => {
  it("sums currency and number metrics across rows", () => {
    const rows = [
      row({ "Amount spent": "100", "Campaign name": "A" }),
      row({ "Amount spent": "250", "Campaign name": "A" }),
    ];
    const result = aggregateDynamicMetrics(rows, [metric()]);
    expect(result.spend).toBe(350);
  });

  it("averages non-zero values for percentage/ratio/duration metrics", () => {
    const rows = [row({ CTR: "2" }), row({ CTR: "4" }), row({ CTR: "0" })];
    const m = metric({ key: "ctr", format: "percentage", csvName: "ctr" });
    const result = aggregateDynamicMetrics(rows, [m]);
    // Average of the two non-zero values (2, 4) = 3 — zero rows excluded,
    // same treatment the existing fixed CTR/CPC pipeline already gives.
    expect(result.ctr).toBe(3);
  });

  it("returns 0 for a percentage/ratio metric when every row's value is zero", () => {
    const rows = [row({ CTR: "0" }), row({ CTR: "0" })];
    const m = metric({ key: "ctr", format: "percentage", csvName: "ctr" });
    const result = aggregateDynamicMetrics(rows, [m]);
    expect(result.ctr).toBe(0);
  });

  it("resolves the raw header case-insensitively against the dictionary's lowercase csvName", () => {
    const rows = [row({ "AMOUNT SPENT": "50" })];
    const result = aggregateDynamicMetrics(rows, [metric()]);
    expect(result.spend).toBe(50);
  });

  it("skips a metric whose csvName has no matching header in this CSV", () => {
    const rows = [row({ "Amount spent": "100" })];
    const m = metric({ key: "website_leads", csvName: "website leads" });
    const result = aggregateDynamicMetrics(rows, [m]);
    expect(result.website_leads).toBeUndefined();
  });

  it("computes each selected metric independently in one pass", () => {
    const rows = [
      row({ "Amount spent": "100", Reach: "1000" }),
      row({ "Amount spent": "200", Reach: "2000" }),
    ];
    const metrics = [metric(), metric({ key: "reach", label: "REACH", format: "number", csvName: "reach" })];
    const result = aggregateDynamicMetrics(rows, metrics);
    expect(result.spend).toBe(300);
    expect(result.reach).toBe(3000);
  });

  it("returns an empty object for an empty rows array", () => {
    expect(aggregateDynamicMetrics([], [metric()])).toEqual({});
  });

  it("returns an empty object when no metrics are given", () => {
    expect(aggregateDynamicMetrics([row({ "Amount spent": "100" })], [])).toEqual({});
  });
});
