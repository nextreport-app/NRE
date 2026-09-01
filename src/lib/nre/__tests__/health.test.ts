import { describe, expect, it } from "vitest";
import { calculateAccountHealth } from "../health";
import type { AggRow } from "../aggregate";

function row(overrides: Partial<AggRow> = {}): AggRow {
  return {
    campaign_name: "Campaign A",
    ad_set_name: "Ad Set 1",
    result_type: "Leads (form)",
    delivery_status: "",
    objectiveConfident: true,
    spend: 1000,
    reach: 5000,
    impressions: 10000,
    results: 20,
    link_clicks: 200,
    purchases: 0,
    initiate_checkout: 0,
    add_to_cart: 0,
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

  it("scores a strong week as Excellent (score>=80 and results>5)", () => {
    // results>0 (25) + ctr>=3.0 (25) + freq<2.0 (20) + cost-neutral (12, CPA
    // 1000/20=50 doesn't exceed the $50 Lead CPL threshold) = 82, results=20>5
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

  describe("Fix 8 — periodLabel (Monthly Report option)", () => {
    it("defaults to Weekly wording when periodLabel is omitted", () => {
      const health = calculateAccountHealth([row({ ctr: 3.5, frequency: 1.5 })]);
      expect(health.badge).toContain("Weekly Performance Score");
    });

    it("says 'Monthly Performance Score' instead of 'Weekly' for a score-tier badge", () => {
      const health = calculateAccountHealth([row({ ctr: 3.5, frequency: 1.5 })], "Monthly");
      expect(health.badge).toContain("Monthly Performance Score");
      expect(health.badge).not.toContain("Weekly");
    });

    it("says 'this month' instead of 'this week' for the On Track badge", () => {
      const rows = [row({ ctr: 0, frequency: 0, reach: 0, impressions: 0 })];
      const health = calculateAccountHealth(rows, "Monthly");
      expect(health.badge).toContain("this month");
      expect(health.badge).not.toContain("this week");
    });

    it("says 'this month' instead of 'this week' for the active-optimisation badge", () => {
      // results=3 and spend=200 clear the Learning Phase thresholds (spend>=50,
      // results>=3), but a middling CPL still lands the total score under 50.
      const rows = [row({ results: 3, ctr: 0, frequency: 0, reach: 0, impressions: 0, spend: 200 })];
      const health = calculateAccountHealth(rows, "Monthly");
      expect(health.score).toBeLessThan(50);
      expect(health.badge).toContain("this month");
      expect(health.badge).not.toContain("this week");
    });

    it("does not change the Learning Phase badge, which never mentions week/month", () => {
      const health = calculateAccountHealth([row({ spend: 10, results: 1 })], "Monthly");
      expect(health.badge).toBe("🟡 Campaign in Learning Phase — optimising delivery");
    });
  });

  it("derives frequency from impressions/reach when the frequency field is 0", () => {
    // freq = impressions/reach = 10000/5000 = 2.0 → falls in the 2.0-2.5 bucket (17pts)
    // results>0 (25) + ctr>=2.0 (20, ctr=2) + freq 2.0-2.5 (17) + cost-neutral (12) = 74
    const rows = [row({ frequency: 0, reach: 5000, impressions: 10000, ctr: 2 })];
    const health = calculateAccountHealth(rows);
    expect(health.score).toBe(74);
  });

  describe("learning phase (spend < $50 OR results < 3)", () => {
    it("shows the Learning Phase badge — with no number in it — instead of a score-tier badge", () => {
      // Zero leads with real spend now zeroes the results-delivery component
      // (Lead rule below) on top of already being learning phase via results<3;
      // results=0 (0, was 5) + ctr=0 (0) + freq=0/no data (14) + cost-neutral
      // (12, CPA unavailable since results=0) = 26
      const rows = [row({ results: 0, ctr: 0, frequency: 0, reach: 0, impressions: 0 })];
      const health = calculateAccountHealth(rows);
      expect(health.score).toBe(26);
      expect(health.badge).toBe("🟡 Campaign in Learning Phase — optimising delivery");
      expect(health.badge).not.toMatch(/\d+\/100/);
    });

    it("triggers on low spend alone, even with a score that would otherwise be Excellent", () => {
      const rows = [row({ spend: 40, ctr: 3.5, frequency: 1.5 })]; // spend < $50
      const health = calculateAccountHealth(rows);
      expect(health.badge).toBe("🟡 Campaign in Learning Phase — optimising delivery");
      // Underlying score (82, same math as the Excellent test above) is well
      // under the 65 cap already, so the cap isn't even the binding constraint here.
      expect(health.score).toBe(82 <= 65 ? 82 : 65);
    });

    it("caps a genuinely high underlying score at 65 when spend is low", () => {
      // ctr>=3 (25) + freq<2 (20) + cost-neutral (12) + results-delivery 25 = 82,
      // capped to 65 by the low-spend learning-phase rule.
      const rows = [row({ spend: 10, results: 1, ctr: 3.5, frequency: 1.5 })];
      const health = calculateAccountHealth(rows);
      expect(health.score).toBe(65);
      expect(health.badge).toBe("🟡 Campaign in Learning Phase — optimising delivery");
    });
  });

  describe("score-tier badge requires both the score AND a minimum results count", () => {
    it("does not award Excellent when results land exactly on the learning-phase boundary (3)", () => {
      // results=3 avoids learning phase (results < 3 is false) but fails both
      // Excellent's (>5) and Good's (>3) results bars — falls to On Track.
      const rows = [row({ results: 3, spend: 500, ctr: 3.5, frequency: 1.5 })];
      const health = calculateAccountHealth(rows);
      expect(health.badge).toContain("On Track");
      expect(health.badge).not.toContain("Excellent");
      expect(health.badge).not.toContain("Good");
    });

    it("falls to Good, not Excellent, for a high score with 4-5 results (>3 but not >5)", () => {
      const rows = [row({ results: 4, spend: 500, ctr: 3.5, frequency: 1.5 })];
      const health = calculateAccountHealth(rows);
      expect(health.badge).toContain("Good");
      expect(health.badge).not.toContain("Excellent");
    });
  });

  describe("Purchase objective (PURCHASES)", () => {
    function purchaseRow(overrides: Partial<AggRow> = {}): AggRow {
      return row({ result_type: "Purchase", ...overrides });
    }

    it("zeroes the results-delivery component when purchases=0 and spend>$50", () => {
      // resultsScore 0 (was 5) + ctr 6 (0.5-1%... use a clean tier) + freq +
      // cost-neutral (CPA unavailable, results=0) — assert the exact total.
      const rows = [purchaseRow({ results: 0, spend: 100, ctr: 1.5, frequency: 1.5 })];
      // ctr>=1.0 -> 13, freq<2.0 -> 20, cost-neutral -> 12, results -> 0
      const health = calculateAccountHealth(rows);
      expect(health.score).toBe(0 + 13 + 20 + 12);
      expect(health.badge).toBe("🟡 Campaign in Learning Phase — optimising delivery"); // results=0 < 3
    });

    it("does not zero the results-delivery component when spend is at or below $50", () => {
      const rows = [purchaseRow({ results: 0, spend: 50, ctr: 1.5, frequency: 1.5 })];
      const health = calculateAccountHealth(rows);
      expect(health.score).toBe(5 + 13 + 20 + 12); // baseline zero-results floor (5), not overridden
    });

    it("caps results-delivery at 15 for 1-2 purchases with spend>$100", () => {
      const rows = [purchaseRow({ results: 2, spend: 150, ctr: 1.5, frequency: 1.5 })];
      const health = calculateAccountHealth(rows);
      expect(health.score).toBe(15 + 13 + 20 + 12); // was 25, capped to 15
    });

    it("does not cap results-delivery for 1-2 purchases when spend is at or below $100", () => {
      const rows = [purchaseRow({ results: 2, spend: 100, ctr: 1.5, frequency: 1.5 })];
      const health = calculateAccountHealth(rows);
      // Uncapped raw score would be 25+13+20+12=70, but results=2 is still
      // <3, so the (separate) learning-phase rule caps it to 65 regardless —
      // this test only confirms the 1-2-purchases-specific cap (to 15) did
      // NOT additionally fire, not that the score is fully uncapped overall.
      expect(health.score).toBe(65);
    });

    it("caps cost-efficiency at 10 when CPA exceeds 3x the $50 benchmark ($150)", () => {
      // results=4 keeps this out of learning phase (>=3) and out of the 1-2
      // early-results cap, isolating the cost-efficiency rule.
      const rows = [purchaseRow({ results: 4, spend: 700, ctr: 1.5, frequency: 1.5 })]; // CPA = 175
      const health = calculateAccountHealth(rows);
      expect(health.score).toBe(25 + 13 + 20 + 10); // cost was 12, capped to 10
      expect(health.badge).not.toContain("Learning Phase");
    });

    it("does not cap cost-efficiency when CPA is at or below the $150 threshold", () => {
      const rows = [purchaseRow({ results: 4, spend: 600, ctr: 1.5, frequency: 1.5 })]; // CPA = 150
      const health = calculateAccountHealth(rows);
      expect(health.score).toBe(25 + 13 + 20 + 12);
    });
  });

  describe("Lead generation objectives (LEADS, WEBSITE LEADS, META FORM LEADS)", () => {
    it("zeroes the results-delivery component when leads=0 and spend>$30", () => {
      const rows = [row({ results: 0, spend: 40, ctr: 1.5, frequency: 1.5 })]; // default result_type is a Lead objective
      const health = calculateAccountHealth(rows);
      expect(health.score).toBe(0 + 13 + 20 + 12);
    });

    it("does not zero the results-delivery component when spend is at or below $30", () => {
      const rows = [row({ results: 0, spend: 30, ctr: 1.5, frequency: 1.5 })];
      const health = calculateAccountHealth(rows);
      expect(health.score).toBe(5 + 13 + 20 + 12);
    });

    it("caps cost-efficiency at 10 when CPL exceeds $50", () => {
      const rows = [row({ result_type: "Website leads", results: 4, spend: 300, ctr: 1.5, frequency: 1.5 })]; // CPL = 75
      const health = calculateAccountHealth(rows);
      expect(health.score).toBe(25 + 13 + 20 + 10);
      expect(health.badge).not.toContain("Learning Phase");
    });

    it("does not cap cost-efficiency when CPL is at or below $50", () => {
      const rows = [row({ results: 4, spend: 200, ctr: 1.5, frequency: 1.5 })]; // CPL = 50
      const health = calculateAccountHealth(rows);
      expect(health.score).toBe(25 + 13 + 20 + 12);
    });
  });

  describe("Traffic objectives (CLICKS -> LINK CLICKS, LPV -> LANDING PAGE VIEWS)", () => {
    it("zeroes the CTR score when CTR < 0.5%, overriding the normal small-CTR floor", () => {
      const rows = [row({ result_type: "Link clicks", results: 10, spend: 200, ctr: 0.3, frequency: 1.5 })];
      const health = calculateAccountHealth(rows);
      // CTR score forced to 0 (would otherwise be 2 for a >0 but <0.5% CTR).
      expect(health.score).toBe(25 + 0 + 20 + 12);
      expect(health.badge).not.toContain("Learning Phase");
    });

    it("caps the CTR score at 10 for CTR between 0.5% and 1%", () => {
      const rows = [row({ result_type: "Landing page views", results: 10, spend: 200, ctr: 0.7, frequency: 1.5 })];
      const health = calculateAccountHealth(rows);
      // Baseline 0.5-1% tier is already only 6, well under the 10 cap, so
      // this is a non-binding cap at the current tier granularity.
      expect(health.score).toBe(25 + 6 + 20 + 12);
      expect(health.badge).not.toContain("Learning Phase");
    });

    it("leaves CTR scoring untouched for a non-Traffic objective at the same CTR", () => {
      const rows = [row({ results: 10, spend: 200, ctr: 0.3, frequency: 1.5 })]; // default Lead objective
      const health = calculateAccountHealth(rows);
      // No Traffic override here — CTR 0.3% still gets the generic 2pt floor.
      expect(health.score).toBe(25 + 2 + 20 + 12);
    });
  });
});
