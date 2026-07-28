import { describe, expect, it } from "vitest";
import {
  buildFallbackInsights,
  buildFallbackSummary,
  buildInsightPrompt,
  buildSummaryPrompt,
  capInsights,
  capSummary,
} from "../prompts";
import type { AiContext } from "../../nre/report-data";

function ctx(overrides: Partial<AiContext> = {}): AiContext {
  return {
    ctx: "Shoes - Purchases (combined 2 ad sets)",
    dateRange: "Jul 13 - Jul 19",
    spend: "₹1,050",
    reach: "12,600",
    impressions: "45,000",
    results: "21",
    cpr: "₹50.00",
    ctr: "2.00%",
    cpc: "₹3.50",
    resultLabel: "PURCHASES",
    costLabel: "COST PER PURCHASE",
    freq: 2.5,
    resultsNum: 21,
    hasResults: true,
    spendNum: 1050,
    ...overrides,
  };
}

describe("buildSummaryPrompt", () => {
  it("uses the exact fixed structure from the product owner's spec", () => {
    const prompt = buildSummaryPrompt(ctx());
    expect(prompt).toContain("Write a campaign performance summary for a Meta Ads weekly client report. Write exactly 2 sentences following this structure:");
    expect(prompt).toContain("Sentence 1: During [date range], the [campaign name] campaign generated [results count] [objective label] at a [CPR] [cost label], reaching [reach] people with [impressions] impressions.");
    expect(prompt).toContain("Sentence 2: The campaign achieved a [CTR]% click-through rate and a [CPC] cost per click, reflecting [positive/neutral/cautious] audience engagement this week.");
    expect(prompt).toContain("Keep total length under 60 words");
  });

  it("substitutes every {token} in the Data line with the slide's real numbers", () => {
    const prompt = buildSummaryPrompt(ctx());
    expect(prompt).toContain(
      "Data: Campaign: Shoes - Purchases (combined 2 ad sets), Date: Jul 13 - Jul 19, Spend: ₹1,050, Reach: 12,600, Impressions: 45,000, PURCHASES: 21, COST PER PURCHASE: ₹50.00, CTR: 2.00%, CPC: ₹3.50",
    );
  });

  it("never mentions frequency — dropped from the new fixed structure", () => {
    const prompt = buildSummaryPrompt(ctx({ freq: 5 }));
    expect(prompt).not.toContain("frequency");
    expect(prompt).not.toContain("creative fatigue");
  });

  it("produces the identical prompt regardless of hasResults — no separate zero-results branch", () => {
    const withResults = buildSummaryPrompt(ctx({ hasResults: true }));
    const withoutResults = buildSummaryPrompt(ctx({ hasResults: false }));
    expect(withResults).toBe(withoutResults);
  });
});

describe("buildInsightPrompt", () => {
  it("uses the exact fixed structure from the product owner's spec", () => {
    const prompt = buildInsightPrompt(ctx());
    expect(prompt).toContain("Write the Key Insights and Next Strategy section for a Meta Ads weekly client report. Write exactly 3 sentences following this structure:");
    expect(prompt).toContain("Sentence 1: One specific insight about what performed well or what the data shows this week — cite a real metric number.");
    expect(prompt).toContain("Sentence 2: One specific insight about what needs attention or a notable trend — cite a real metric number.");
    expect(prompt).toContain(
      "Sentence 3: The recommended next actions — always include: allocating budget toward top-performing ads, pausing underperformers, testing new creatives, and refining targeting or bidding strategy.",
    );
    expect(prompt).toContain("Do not start with This week or During this period — vary the opening");
    expect(prompt).toContain("Keep total length under 75 words");
  });

  it("substitutes every {token} in the Data line — no Date or Impressions field here", () => {
    const prompt = buildInsightPrompt(ctx());
    expect(prompt).toContain(
      "Data: Campaign: Shoes - Purchases (combined 2 ad sets), Spend: ₹1,050, Reach: 12,600, PURCHASES: 21, COST PER PURCHASE: ₹50.00, CTR: 2.00%, CPC: ₹3.50",
    );
    expect(prompt).not.toContain("Date:");
    expect(prompt).not.toContain("Impressions:");
  });

  it("never mentions frequency — dropped from the new fixed structure", () => {
    const prompt = buildInsightPrompt(ctx({ freq: 5 }));
    expect(prompt).not.toContain("frequency");
    expect(prompt).not.toContain("creative refresh");
  });

  it("produces the identical prompt regardless of hasResults — no separate zero-results branch", () => {
    const withResults = buildInsightPrompt(ctx({ hasResults: true }));
    const withoutResults = buildInsightPrompt(ctx({ hasResults: false }));
    expect(withResults).toBe(withoutResults);
  });
});

describe("capSummary", () => {
  it("leaves short text untouched", () => {
    expect(capSummary("Short summary.")).toBe("Short summary.");
  });

  it("cuts at the last sentence boundary before 220 chars", () => {
    const long = "A".repeat(100) + ". " + "B".repeat(100) + ". " + "C".repeat(100) + ".";
    const result = capSummary(long);
    expect(result.length).toBeLessThanOrEqual(221);
    expect(result.endsWith(".")).toBe(true);
  });
});

describe("capInsights", () => {
  it("strips a leading bullet marker", () => {
    expect(capInsights("- Some insight.")).toBe("Some insight.");
    expect(capInsights("• Some insight.")).toBe("Some insight.");
  });

  it("falls back to a placeholder for empty input", () => {
    expect(capInsights("   ")).toBe("Insights not available.");
  });

  it("cuts long text at a sentence boundary before 320 chars", () => {
    const long = "X".repeat(400) + ".";
    const result = capInsights(long);
    expect(result.length).toBeLessThanOrEqual(321);
  });
});

describe("buildFallbackSummary", () => {
  it("builds the exact 2-sentence structure from real data, always ending in a period", () => {
    const result = buildFallbackSummary(ctx());
    expect(result).toBe(
      "During Jul 13 - Jul 19, the Shoes - Purchases (combined 2 ad sets) campaign generated 21 PURCHASES at a " +
        "₹50.00 COST PER PURCHASE, reaching 12,600 people with 45,000 impressions. The campaign achieved a 2.00% " +
        "click-through rate and a ₹3.50 cost per click, reflecting current audience engagement levels.",
    );
    expect(result.endsWith(".")).toBe(true);
  });

  it("never double-appends a percent sign, since ctx.ctr already carries its own '%'", () => {
    const result = buildFallbackSummary(ctx({ ctr: "0.35%" }));
    expect(result).toContain("achieved a 0.35% click-through rate");
    expect(result).not.toContain("0.35%%");
  });
});

describe("buildFallbackInsights", () => {
  it("builds the exact 3-part structure from real data, always ending in a period", () => {
    const result = buildFallbackInsights(ctx());
    expect(result).toBe(
      "This week Shoes - Purchases (combined 2 ad sets) spent ₹1,050 reaching 12,600 people with a 2.00% CTR. " +
        "With 21 PURCHASES recorded, the campaign shows strong traction at ₹50.00 per result. To maximise results, " +
        "budget will shift toward top-performing ads while underperformers are paused, with fresh creatives and " +
        "refined targeting planned for the coming week.",
    );
    expect(result.endsWith(".")).toBe(true);
  });

  it.each([
    [0, "early"],
    [2, "early"],
    [3, "developing"],
    [9, "developing"],
    [10, "strong"],
    [50, "strong"],
  ])("describes %i results as '%s' traction", (resultsNum, expectedWord) => {
    const result = buildFallbackInsights(ctx({ resultsNum }));
    expect(result).toContain(`shows ${expectedWord} traction`);
  });

  it("never double-appends a percent sign", () => {
    const result = buildFallbackInsights(ctx({ ctr: "0.35%" }));
    expect(result).toContain("with a 0.35% CTR");
    expect(result).not.toContain("0.35%%");
  });
});
