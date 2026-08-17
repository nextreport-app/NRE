import { describe, it, expect } from "vitest";
import { aggregateDynamicMetrics, lookupMetricValue, type MetricRef } from "../dynamic-metrics";
import type { NreRow } from "../columns";

function row(raw: Record<string, string>): NreRow {
  return { _raw: raw } as NreRow;
}

function metric(overrides: Partial<MetricRef> = {}): MetricRef {
  return {
    key: "spend",
    format: "currency",
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
    const metrics = [metric(), metric({ key: "reach", format: "number", csvName: "reach" })];
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
    const m: MetricRef = {
      key: "target_cpa",
      format: "currency",
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

describe("aggregateDynamicMetrics — CPC (All)/Cost per Link Click never shows a dash when spend and clicks are both present (Step 5)", () => {
  const cpcAll = (): MetricRef => ({
    key: "cpc_all",
    format: "currency",
    csvName: "cpc (all)",
    perUnitOf: "clicks_all",
  });
  const cpcLinkClick = (): MetricRef => ({
    key: "cpc_link_click",
    format: "currency",
    csvName: "cpc (cost per link click)",
    perUnitOf: "link_clicks",
  });

  it("reads the CPC value directly off its own 'CPC (all)' column when present and non-zero, without recomputing", () => {
    // Deliberately no "clicks (all)"/"link clicks"/"clicks" column at all —
    // the old always-recompute-from-clicks behavior would have produced
    // NaN ("—") here; reading the real column directly must win instead.
    const rows = [row({ "Amount spent": "100", "CPC (all)": "2.00" }), row({ "Amount spent": "100", "CPC (all)": "4.00" })];
    const result = aggregateDynamicMetrics(rows, [cpcAll()], "meta");
    expect(result.cpc_all).toBe(3); // average of the two non-zero raw values
  });

  it("tries 'avg. cpc' when 'cpc (all)' isn't present", () => {
    const rows = [row({ "Amount spent": "100", "Avg. CPC": "1.50" })];
    const result = aggregateDynamicMetrics(rows, [cpcAll()], "meta");
    expect(result.cpc_all).toBe(1.5);
  });

  it("tries 'cpc (cost per link click)' and 'average cpc' too, in the documented priority order", () => {
    const rowsLinkClick = [row({ "Amount spent": "100", "CPC (Cost per Link Click)": "0.75" })];
    expect(aggregateDynamicMetrics(rowsLinkClick, [cpcLinkClick()], "meta").cpc_link_click).toBe(0.75);

    const rowsAverage = [row({ "Amount spent": "100", "Average CPC": "0.60" })];
    expect(aggregateDynamicMetrics(rowsAverage, [cpcAll()], "meta").cpc_all).toBe(0.6);
  });

  it("falls back to spend/clicks when the CPC column is missing, using whichever 'clicks' column variant is present", () => {
    const rows = [
      row({ "Amount spent": "50", "Clicks (all)": "20" }),
      row({ "Amount spent": "50", "Clicks (all)": "5" }),
    ];
    const result = aggregateDynamicMetrics(rows, [cpcAll()], "meta");
    expect(result.cpc_all).toBe(100 / 25); // total spend / total clicks
  });

  it("falls back to spend/clicks when the CPC column's own values are all zero", () => {
    const rows = [
      row({ "Amount spent": "60", "CPC (all)": "0", "Link clicks": "30" }),
    ];
    const result = aggregateDynamicMetrics(rows, [cpcAll()], "meta");
    expect(result.cpc_all).toBe(2); // 60 / 30, not "—"
  });

  it("still shows a dash only when spend or clicks are genuinely both absent", () => {
    const rows = [row({ "Amount spent": "60" })]; // no CPC column, no clicks column at all
    const result = aggregateDynamicMetrics(rows, [cpcAll()], "meta");
    expect(Number.isNaN(result.cpc_all)).toBe(true);
  });
});

describe("aggregateDynamicMetrics — ROAS is always calculated from totals, never read off the CSV's own ROAS column (ROAS fix)", () => {
  const roas = (): MetricRef => ({
    key: "results_roas",
    format: "ratio",
    csvName: "results roas",
  });
  const googleRoas = (): MetricRef => ({
    key: "roas",
    format: "ratio",
    csvName: "conv. value / cost",
  });

  it("weekly ROAS is total conversion value / total spend, not the single day that happened to have a purchase", () => {
    // Only day 1 has a purchase (that day's own ROAS column reads 17.62);
    // every other day is 0. A naive "average of non-zero raw values" (the
    // bug) collapses to exactly 17.62 here. The correct weekly figure is
    // sum(conversion value)/sum(spend) across all 7 days.
    const rows = [
      row({ "Amount spent": "50", "Results roas": "17.62", "Purchases conversion value": "881" }),
      row({ "Amount spent": "50", "Results roas": "0" }),
      row({ "Amount spent": "50", "Results roas": "0" }),
      row({ "Amount spent": "50", "Results roas": "0" }),
      row({ "Amount spent": "50", "Results roas": "0" }),
      row({ "Amount spent": "50", "Results roas": "0" }),
      row({ "Amount spent": "50", "Results roas": "0" }),
    ];
    const result = aggregateDynamicMetrics(rows, [{ key: "spend", format: "currency", csvName: "amount spent" }, roas()], "meta");
    expect(result.results_roas).not.toBe(17.62);
    expect(result.results_roas).toBeCloseTo(881 / 350, 5);
  });

  it("formats as '0.46x' for conversion value C$103.95 / spend C$228", () => {
    const rows = [row({ "Amount spent (CAD)": "228", "Purchases conversion value": "103.95", "Purchase roas (return on ad spend)": "99" })];
    expect(lookupMetricValue(rows, roas(), "meta", "C$")).toBe("0.46x");
  });

  it("formats as '0.89x' for conversion value C$103.95 / spend C$117", () => {
    const rows = [row({ "Amount spent (CAD)": "117", "Purchases conversion value": "103.95", "Purchase roas (return on ad spend)": "99" })];
    expect(lookupMetricValue(rows, roas(), "meta", "C$")).toBe("0.89x");
  });

  it("shows '—' when the conversion-value column is missing entirely, even though a ROAS column is present — never falls back to it", () => {
    const rows = [row({ "Amount spent": "100", "Results roas": "4.5" })]; // no conversion-value column at all
    const result = aggregateDynamicMetrics(rows, [{ key: "spend", format: "currency", csvName: "amount spent" }, roas()], "meta");
    expect(Number.isNaN(result.results_roas)).toBe(true);
    expect(lookupMetricValue(rows, roas(), "meta", "$")).toBe("—");
  });

  it("also calculates Google's 'roas' key from conv. value / cost totals, not the CSV's own 'Conv. value / cost' column", () => {
    const rows = [
      row({ Cost: "100", "Conv. value / cost": "9.0", "Conv. value": "20" }),
      row({ Cost: "100", "Conv. value / cost": "0" }),
    ];
    const result = aggregateDynamicMetrics(rows, [{ key: "cost", format: "currency", csvName: "cost" }, googleRoas()], "google");
    expect(result.roas).not.toBe(9.0);
    expect(result.roas).toBeCloseTo(20 / 200, 5);
  });
});
