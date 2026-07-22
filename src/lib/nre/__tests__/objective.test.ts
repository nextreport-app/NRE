import { describe, expect, it } from "vitest";
import {
  getGroupedResultDisplay,
  getResultGroups,
  getResultLabels,
  getSingleRowResultDisplay,
} from "../objective";
import type { AggRow } from "../aggregate";

function row(overrides: Partial<AggRow> = {}): AggRow {
  return {
    campaign_name: "Campaign A",
    ad_set_name: "Ad Set 1",
    result_type: "Leads (form)",
    spend: 1000,
    reach: 5000,
    impressions: 10000,
    results: 20,
    link_clicks: 200,
    ctr: 2,
    cpc: 5,
    cpr: 50,
    frequency: 2,
    date_start: "13-07-2026",
    date_end: "13-07-2026",
    ...overrides,
  };
}

describe("getResultLabels", () => {
  it.each([
    ["Purchase", "PURCHASES", "COST PER PURCHASE"],
    ["Website purchases", "PURCHASES", "COST PER PURCHASE"],
    ["Leads (form)", "LEADS", "COST PER LEAD"],
    ["Sign up", "LEADS", "COST PER LEAD"],
    ["Landing page view", "LANDING PAGE VIEWS", "COST PER LPV"],
    ["Link click", "CLICKS", "COST PER CLICK"],
    ["Reach", "REACH", "COST PER 1K REACH"],
    ["ThruPlay", "VIDEO VIEWS", "COST PER VIEW"],
    ["App install", "APP INSTALLS", "COST PER INSTALL"],
    ["Conversion", "CONVERSIONS", "COST PER CONV"],
    ["", "RESULTS", "COST PER RESULT"],
    ["Something unrecognised", "RESULTS", "COST PER RESULT"],
  ])("classifies %s as %s / %s", (input, resultLabel, costLabel) => {
    expect(getResultLabels(input)).toEqual({ resultLabel, costLabel });
  });

  it("purchase takes priority over lead-like words in the same string", () => {
    expect(getResultLabels("Purchase (order confirmation)").resultLabel).toBe("PURCHASES");
  });
});

describe("getResultGroups", () => {
  it("sums count/spend per result label and sorts by count descending", () => {
    const rows: AggRow[] = [
      row({ result_type: "Leads (form)", results: 10, spend: 500 }),
      row({ result_type: "Lead", results: 5, spend: 250 }),
      row({ result_type: "Purchase", results: 20, spend: 2000 }),
    ];
    const groups = getResultGroups(rows);
    expect(groups[0]).toMatchObject({ label: "PURCHASES", count: 20 });
    expect(groups[1]).toMatchObject({ label: "LEADS", count: 15 });
    expect(groups[1].avgCpr).toBeCloseTo(750 / 15);
  });

  it("multiplies REACH's avgCpr by 1000 when a results count IS present", () => {
    const rows: AggRow[] = [row({ result_type: "Reach", results: 5000, spend: 100 })];
    const groups = getResultGroups(rows);
    expect(groups[0].label).toBe("REACH");
    expect(groups[0].avgCpr).toBeCloseTo((100 / 5000) * 1000);
  });

  it("computes REACH's avgCpr from the reach column directly when results is 0 (real Reach objective)", () => {
    const rows: AggRow[] = [row({ result_type: "Reach", results: 0, reach: 70000, spend: 1400 })];
    const groups = getResultGroups(rows);
    expect(groups[0].label).toBe("REACH");
    expect(groups[0].count).toBe(0);
    expect(groups[0].avgCpr).toBeCloseTo((1400 * 1000) / 70000);
  });
});

describe("getGroupedResultDisplay", () => {
  it("prefers the top non-REACH group over a REACH group", () => {
    const rows: AggRow[] = [
      row({ result_type: "Reach", results: 50000, spend: 1000 }),
      row({ result_type: "Lead", results: 10, spend: 500 }),
    ];
    const display = getGroupedResultDisplay(rows, "$");
    expect(display.resultLabel).toBe("LEADS");
    expect(display.resultValue).toBe("10");
    expect(display.cprValue).toBe("$50.00");
  });

  it("falls back to a REACH group if that's all there is", () => {
    const rows: AggRow[] = [row({ result_type: "Reach", results: 5000, spend: 100 })];
    const display = getGroupedResultDisplay(rows, "$");
    expect(display.resultLabel).toBe("REACH");
  });

  it("shows a dash when there's no cost-per-result signal", () => {
    const rows: AggRow[] = [row({ result_type: "Lead", results: 0, spend: 0 })];
    const display = getGroupedResultDisplay(rows, "$");
    expect(display.cprValue).toBe("—");
    expect(display.resultValue).toBe("0");
  });
});

describe("getSingleRowResultDisplay", () => {
  it("reads resultLabel from result_type and values straight off the row", () => {
    const r = row({ result_type: "Purchase", results: 3, cpr: 250 });
    const display = getSingleRowResultDisplay(r, "$");
    expect(display).toEqual({
      resultLabel: "PURCHASES",
      costLabel: "COST PER PURCHASE",
      resultValue: "3",
      cprValue: "$250.00",
    });
  });
});
