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
    const result = aggregateDynamicMetrics(rows, [metric()], "meta");
    expect(result.spend).toBe(350);
  });

  it("averages non-zero values for percentage/ratio/duration metrics", () => {
    const rows = [row({ CTR: "2" }), row({ CTR: "4" }), row({ CTR: "0" })];
    const m = metric({ key: "ctr", format: "percentage", csvName: "ctr" });
    const result = aggregateDynamicMetrics(rows, [m], "meta");
    // Average of the two non-zero values (2, 4) = 3 — zero rows excluded,
    // same treatment the existing fixed CTR/CPC pipeline already gives.
    expect(result.ctr).toBe(3);
  });

  it("returns 0 for a percentage/ratio metric when every row's value is zero", () => {
    const rows = [row({ CTR: "0" }), row({ CTR: "0" })];
    const m = metric({ key: "ctr", format: "percentage", csvName: "ctr" });
    const result = aggregateDynamicMetrics(rows, [m], "meta");
    expect(result.ctr).toBe(0);
  });

  it("resolves the raw header case-insensitively against the dictionary's lowercase csvName", () => {
    const rows = [row({ "AMOUNT SPENT": "50" })];
    const result = aggregateDynamicMetrics(rows, [metric()], "meta");
    expect(result.spend).toBe(50);
  });

  it("skips a metric whose csvName has no matching header in this CSV", () => {
    const rows = [row({ "Amount spent": "100" })];
    const m = metric({ key: "website_leads", csvName: "website leads" });
    const result = aggregateDynamicMetrics(rows, [m], "meta");
    expect(result.website_leads).toBeUndefined();
  });

  it("computes each selected metric independently in one pass", () => {
    const rows = [
      row({ "Amount spent": "100", Reach: "1000" }),
      row({ "Amount spent": "200", Reach: "2000" }),
    ];
    const metrics = [metric(), metric({ key: "reach", label: "REACH", format: "number", csvName: "reach" })];
    const result = aggregateDynamicMetrics(rows, metrics, "meta");
    expect(result.spend).toBe(300);
    expect(result.reach).toBe(3000);
  });

  it("returns an empty object for an empty rows array", () => {
    expect(aggregateDynamicMetrics([], [metric()], "meta")).toEqual({});
  });

  it("returns an empty object when no metrics are given", () => {
    expect(aggregateDynamicMetrics([row({ "Amount spent": "100" })], [], "meta")).toEqual({});
  });
});

describe("aggregateDynamicMetrics — per-unit cost recompute (Fix 3)", () => {
  it("computes cost_per_result as sum(spend)/sum(results), not a sum of the raw column", () => {
    const rows = [
      row({ "Amount spent": "100", Results: "10", "Cost per result": "999" }),
      row({ "Amount spent": "200", Results: "20", "Cost per result": "999" }),
    ];
    const m = metric({
      key: "cost_per_result",
      csvName: "cost per result",
      perUnitOf: "results",
    });
    const result = aggregateDynamicMetrics(rows, [m], "meta");
    // sum(spend)=300, sum(results)=30 -> 10, NOT 999+999 or their average.
    expect(result.cost_per_result).toBe(10);
  });

  it("computes cost_per_lead as sum(spend)/sum(website leads)", () => {
    const rows = [
      row({ "Amount spent": "50", "Website leads": "2" }),
      row({ "Amount spent": "170", "Website leads": "8" }),
    ];
    const m = metric({ key: "cost_per_lead", csvName: "cost per lead", perUnitOf: "website_leads" });
    const result = aggregateDynamicMetrics(rows, [m], "meta");
    expect(result.cost_per_lead).toBe(220 / 10);
  });

  it("returns NaN (not 0 or a divide-by-zero error) when the denominator is zero", () => {
    const rows = [row({ "Amount spent": "100", Results: "0" })];
    const m = metric({ key: "cost_per_result", csvName: "cost per result", perUnitOf: "results" });
    const result = aggregateDynamicMetrics(rows, [m], "meta");
    expect(Number.isNaN(result.cost_per_result)).toBe(true);
  });

  it("applies perUnitScale for 'cost per 1,000 X' metrics (CPM)", () => {
    const rows = [row({ "Amount spent": "20", Impressions: "10000" })];
    const m = metric({ key: "cpm", csvName: "cpm (cost per 1,000 impressions)", perUnitOf: "impressions", perUnitScale: 1000 });
    const result = aggregateDynamicMetrics(rows, [m], "meta");
    // (20 / 10000) * 1000 = 2
    expect(result.cpm).toBe(2);
  });

  it("averages the metric's own non-zero raw values for perUnitOf '__avg__' (a fixed bid target, not spend/count)", () => {
    const rows = [row({ "Avg. Target CPA": "5" }), row({ "Avg. Target CPA": "15" }), row({ "Avg. Target CPA": "0" })];
    const m: SelectedMetric = {
      key: "target_cpa",
      label: "TARGET CPA",
      format: "currency",
      type: "secondary",
      priority: 60,
      csvName: "avg. target cpa",
      perUnitOf: "__avg__",
    };
    const result = aggregateDynamicMetrics(rows, [m], "google");
    expect(result.target_cpa).toBe(10);
  });

  it("does not require the denominator column to be among the selected metrics — resolves it from the dictionary directly", () => {
    // "results" is NOT in the selected metrics list at all, only cost_per_result is.
    const rows = [row({ "Amount spent": "40", Results: "8" })];
    const m = metric({ key: "cost_per_result", csvName: "cost per result", perUnitOf: "results" });
    const result = aggregateDynamicMetrics(rows, [m], "meta");
    expect(result.cost_per_result).toBe(5);
  });
});
