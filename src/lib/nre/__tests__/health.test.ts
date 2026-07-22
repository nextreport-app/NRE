import { describe, expect, it } from "vitest";
import { budgetSummaryLine, calculateAccountHealth } from "../health";
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

describe("calculateAccountHealth", () => {
  it("returns score 0 with the paused-style badge for no rows", () => {
    const health = calculateAccountHealth([]);
    expect(health.score).toBe(0);
    expect(health.badge).toContain("Active Optimization Phase");
  });

  it("scores a strong week as Excellent (>=80)", () => {
    // results>0 (25) + ctr>=3.0 (25) + freq<2.0 (20) + cost-neutral (12) = 82
    const rows = [row({ ctr: 3.5, frequency: 1.5 })];
    const health = calculateAccountHealth(rows);
    expect(health.score).toBe(82);
    expect(health.badge).toContain("Excellent");
  });

  it("scores a mediocre week as On Track (50-69)", () => {
    // results>0 (25) + ctr=0 (0) + freq=0/no data (14) + cost-neutral (12) = 51
    const rows = [row({ ctr: 0, frequency: 0, reach: 0, impressions: 0 })];
    const health = calculateAccountHealth(rows);
    expect(health.score).toBe(51);
    expect(health.badge).toContain("On Track");
  });

  it("scores zero results as under active optimisation (<50)", () => {
    // results=0 (5) + ctr=0 (0) + freq=0/no data (14) + cost-neutral (12) = 31
    const rows = [row({ results: 0, ctr: 0, frequency: 0, reach: 0, impressions: 0 })];
    const health = calculateAccountHealth(rows);
    expect(health.score).toBe(31);
    expect(health.badge).toContain("active optimisation");
  });

  it("derives frequency from impressions/reach when the frequency field is 0", () => {
    // freq = impressions/reach = 10000/5000 = 2.0 → falls in the 2.0-2.5 bucket (17pts)
    // results>0 (25) + ctr>=2.0 (20, ctr=2) + freq 2.0-2.5 (17) + cost-neutral (12) = 74
    const rows = [row({ frequency: 0, reach: 5000, impressions: 10000, ctr: 2 })];
    const health = calculateAccountHealth(rows);
    expect(health.score).toBe(74);
  });
});

describe("budgetSummaryLine", () => {
  it("returns an empty string when there is no budget", () => {
    expect(budgetSummaryLine(1000, null, "$")).toBe("");
    expect(budgetSummaryLine(1000, 0, "$")).toBe("");
  });

  it("formats spend/budget/percent/days-remaining", () => {
    const now = new Date(2026, 6, 22); // July 22 2026 (local) — 31 days in July
    const line = budgetSummaryLine(25000, 50000, "₹", now);
    expect(line).toBe("Monthly Budget: ₹25,000 of ₹50,000 used (50.0%) — 9 days remaining");
  });
});
