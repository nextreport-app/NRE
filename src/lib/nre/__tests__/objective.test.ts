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
    ["Leads (form)", "LEADS (FORM)", "COST PER LEAD"],
    ["Lead (form)", "LEADS (FORM)", "COST PER LEAD"],
    ["Sign up", "LEADS", "COST PER LEAD"],
    ["Website subscriptions", "WEBSITE SUBSCRIPTIONS", "COST PER SUBSCRIPTION"],
    ["Website subscription", "WEBSITE SUBSCRIPTIONS", "COST PER SUBSCRIPTION"],
    ["Subscriptions", "WEBSITE SUBSCRIPTIONS", "COST PER SUBSCRIPTION"],
    ["Landing page view", "LANDING PAGE VIEWS", "COST PER LPV"],
    ["Link click", "CLICKS", "COST PER CLICK"],
    ["Reach", "REACH", "COST PER 1K REACH"],
    ["ThruPlay", "VIDEO VIEWS", "COST PER VIEW"],
    ["App install", "APP INSTALLS", "COST PER INSTALL"],
    ["Conversion", "CONVERSIONS", "COST PER CONV"],
    ["Quote Request Submitted", "QUOTE REQUESTS", "COST PER QUOTE REQUEST"],
    ["Quote request", "QUOTE REQUESTS", "COST PER QUOTE REQUEST"],
    ["Quote requests", "QUOTE REQUESTS", "COST PER QUOTE REQUEST"],
    ["Contact", "CONTACTS", "COST PER CONTACT"],
    ["Schedule", "APPOINTMENTS", "COST PER APPOINTMENT"],
    ["Find location", "STORE VISITS", "COST PER VISIT"],
    ["Store visits", "STORE VISITS", "COST PER VISIT"],
    ["Complete registration", "REGISTRATIONS", "COST PER REGISTRATION"],
    ["Submit application", "APPLICATIONS", "COST PER APPLICATION"],
    ["Start trial", "TRIALS", "COST PER TRIAL"],
    ["Donate", "DONATIONS", "COST PER DONATION"],
    ["Donations", "DONATIONS", "COST PER DONATION"],
    ["", "RESULTS", "COST PER RESULT"],
  ])("classifies %s as %s / %s", (input, resultLabel, costLabel) => {
    expect(getResultLabels(input)).toEqual({ resultLabel, costLabel });
  });

  it("purchase takes priority over lead-like words in the same string", () => {
    expect(getResultLabels("Purchase (order confirmation)").resultLabel).toBe("PURCHASES");
  });

  it("keeps 'Leads (form)' distinct from the generic LEADS bucket a bare 'Lead' falls into", () => {
    expect(getResultLabels("Leads (form)").resultLabel).toBe("LEADS (FORM)");
    expect(getResultLabels("Lead").resultLabel).toBe("LEADS");
  });

  it("keeps 'Submit application' distinct from the generic APP INSTALLS bucket's 'app' substring match", () => {
    expect(getResultLabels("Submit application").resultLabel).toBe("APPLICATIONS");
    expect(getResultLabels("App install").resultLabel).toBe("APP INSTALLS");
  });

  it("falls back to the raw result_type (cleaned up), not a generic RESULTS label, when unrecognized", () => {
    expect(getResultLabels("Some Custom Event")).toEqual({
      resultLabel: "SOME CUSTOM EVENT",
      costLabel: "COST PER SOME CUSTOM EVENT",
    });
  });

  it("still falls back to the generic RESULTS bucket for a genuinely blank result_type", () => {
    // aggregate.ts's data-first objective correction relies on a blank
    // result_type mapping to the generic RESULTS bucket to detect "no
    // result type set" rows — only a *present*, unrecognized string should
    // keep its own text.
    expect(getResultLabels("")).toEqual({ resultLabel: "RESULTS", costLabel: "COST PER RESULT" });
    expect(getResultLabels(null)).toEqual({ resultLabel: "RESULTS", costLabel: "COST PER RESULT" });
    expect(getResultLabels(undefined)).toEqual({ resultLabel: "RESULTS", costLabel: "COST PER RESULT" });
  });
});

describe("getResultGroups", () => {
  it("sums count/spend per result label and sorts by count descending", () => {
    const rows: AggRow[] = [
      row({ result_type: "Lead", results: 10, spend: 500 }),
      row({ result_type: "Sign up", results: 5, spend: 250 }),
      row({ result_type: "Purchase", results: 20, spend: 2000 }),
    ];
    const groups = getResultGroups(rows);
    expect(groups[0]).toMatchObject({ label: "PURCHASES", count: 20 });
    expect(groups[1]).toMatchObject({ label: "LEADS", count: 15 });
    expect(groups[1].avgCpr).toBeCloseTo(750 / 15);
  });

  it("keeps 'Leads (form)' and 'Website subscriptions' as separate groups, not folded into a generic bucket", () => {
    const rows: AggRow[] = [
      row({ result_type: "Leads (form)", results: 12, spend: 600 }),
      row({ result_type: "Website subscriptions", results: 8, spend: 400 }),
    ];
    const groups = getResultGroups(rows);
    const leads = groups.find((g) => g.label === "LEADS (FORM)");
    const subs = groups.find((g) => g.label === "WEBSITE SUBSCRIPTIONS");
    expect(leads).toMatchObject({ label: "LEADS (FORM)", costLabel: "COST PER LEAD", count: 12 });
    expect(subs).toMatchObject({
      label: "WEBSITE SUBSCRIPTIONS",
      costLabel: "COST PER SUBSCRIPTION",
      count: 8,
    });
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
