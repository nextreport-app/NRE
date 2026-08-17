import { describe, expect, it } from "vitest";
import {
  buildFallbackInsights,
  buildFallbackSummary,
  buildInsightPrompt,
  buildPausedZeroResultsInsights,
  buildPausedZeroResultsSummary,
  buildSummaryPrompt,
  buildZeroResultsSummary,
  capInsights,
  capSummary,
  resultCountMismatch,
} from "../prompts";
import type { AiContext } from "../../nre/report-data";

function ctx(overrides: Partial<AiContext> = {}): AiContext {
  return {
    ctx: "Shoes - Purchases",
    dateRange: "Jul 13 - Jul 19",
    spend: "₹1,050",
    reach: "12,600",
    impressions: "45,000",
    results: "21",
    cpr: "₹50.00",
    ctr: "2.00%",
    cpc: "₹3.50",
    cpm: "₹23.33",
    resultLabel: "PURCHASES",
    costLabel: "COST PER PURCHASE",
    freq: 2.5,
    resultsNum: 21,
    hasResults: true,
    spendNum: 1050,
    isInactive: false,
    ...overrides,
  };
}

describe("buildSummaryPrompt", () => {
  it("uses the exact fixed structure from the product owner's spec (permanent fix — primary result count/cost per result must always be mentioned)", () => {
    const prompt = buildSummaryPrompt(ctx());
    expect(prompt).toContain(
      "Write a campaign performance summary for a Meta Ads weekly client report. Write exactly 2 sentences.",
    );
    expect(prompt).toContain("Sentence 1 must mention ALL of these in order:");
    expect(prompt).toContain("- The primary result count and label (e.g. 20 leads, 47 website leads, 312 link clicks, 5 purchases)");
    expect(prompt).toContain("- The cost per result (e.g. at $40 per lead, at $6.04 cost per lead)");
    expect(prompt).toContain("- The total spend (e.g. spending $800 this week)");
    expect(prompt).toContain("- Reach and impressions");
    expect(prompt).toContain("Sentence 2 must mention:");
    expect(prompt).toContain("- CTR percentage");
    expect(prompt).toContain("- CPC value");
    expect(prompt).toContain("- A brief engagement observation");
    expect(prompt).toContain(
      "Example of correct format: \"This campaign generated 20 leads at $40 cost per lead, spending $800 to reach 22,170 people across 28,192 impressions. The campaign achieved a 2.0% click-through rate at $1.23 cost per click, reflecting moderate audience engagement this week.\"",
    );
    expect(prompt).toContain("- ALWAYS mention the primary result count and cost in sentence 1 — this is the most important metric");
    expect(prompt).toContain("- If results = 0, say \"recorded no [result label] this week\" in sentence 1");
    expect(prompt).toContain("- Use real numbers from the data — never invent or estimate");
    expect(prompt).toContain("- Keep total under 60 words");
    expect(prompt).toContain("- Professional tone like a senior account manager");
  });

  it("substitutes every {token} in the Data line with the slide's real numbers", () => {
    const prompt = buildSummaryPrompt(ctx());
    expect(prompt).toContain(
      "Data: Campaign: Shoes - Purchases, Date: Jul 13 - Jul 19, Spend: ₹1,050, Reach: 12,600, Impressions: 45,000, PURCHASES: 21, COST PER PURCHASE: ₹50.00, CTR: 2.00%, CPC: ₹3.50",
    );
  });

  it("never mentions frequency — dropped from the fixed structure", () => {
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
      "Data: Campaign: Shoes - Purchases, Spend: ₹1,050, Reach: 12,600, PURCHASES: 21, COST PER PURCHASE: ₹50.00, CTR: 2.00%, CPC: ₹3.50",
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

  it("cuts at the last sentence boundary before 400 chars", () => {
    const long = "A".repeat(150) + ". " + "B".repeat(150) + ". " + "C".repeat(150) + ".";
    const result = capSummary(long);
    expect(result.length).toBeLessThanOrEqual(401);
    expect(result.endsWith(".")).toBe(true);
  });

  it("does not cut a decimal point (e.g. inside a dollar amount) mistaken for a sentence end", () => {
    // Regression test for the bug that caused a genuinely complete,
    // realistic-length AI response to be re-truncated: a naive
    // lastIndexOf(".", limit) would treat the "." in "$2.50" as a sentence
    // end. This fixture is long enough to exceed SUMMARY_CHAR_LIMIT and ends
    // with a decimal value right at the boundary, followed by more real
    // sentence content — capSummary must not stop at the decimal point.
    const long =
      "A".repeat(380) +
      " reflecting a $2.50 cost per click and a 4.48% click-through rate this week overall. " +
      "B".repeat(50) +
      ".";
    const result = capSummary(long);
    expect(result).not.toMatch(/\$2\.$/);
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

  it("cuts long text at a sentence boundary before 500 chars", () => {
    const long = "X".repeat(600) + ".";
    const result = capInsights(long);
    expect(result.length).toBeLessThanOrEqual(501);
    expect(result.endsWith(".")).toBe(true);
  });
});

describe("buildFallbackSummary", () => {
  it("builds the exact 2-sentence structure from real data, always ending in a period, results/cost per result always in sentence 1 (Fix 3 — no longer opens with the date/campaign name; permanent fix — spend is now always included)", () => {
    const result = buildFallbackSummary(ctx());
    expect(result).toBe(
      "This campaign generated 21 PURCHASES at ₹50.00 COST PER PURCHASE, spending ₹1,050 to reach 12,600 people " +
        "across 45,000 impressions. The campaign achieved a 2.00% click-through rate at ₹3.50 cost per click, " +
        "reflecting current audience engagement levels.",
    );
    expect(result.endsWith(".")).toBe(true);
    expect(result).not.toContain("During");
    expect(result).not.toContain("Shoes - Purchases");
  });

  it("never omits results and cost per result from sentence 1", () => {
    const result = buildFallbackSummary(ctx());
    const firstSentence = result.split(". ")[0];
    expect(firstSentence).toContain("21");
    expect(firstSentence).toContain("PURCHASES");
    expect(firstSentence).toContain("₹50.00");
    expect(firstSentence).toContain("COST PER PURCHASE");
  });

  it("always includes total spend (previously missing from the fallback)", () => {
    const result = buildFallbackSummary(ctx());
    expect(result).toContain("spending ₹1,050");
  });

  it("never double-appends a percent sign, since ctx.ctr already carries its own '%'", () => {
    const result = buildFallbackSummary(ctx({ ctr: "0.35%" }));
    expect(result).toContain("achieved a 0.35% click-through rate");
    expect(result).not.toContain("0.35%%");
  });
});

describe("buildZeroResultsSummary", () => {
  it("builds the exact 2-sentence structure from real data, always ending in a period (Fix 4 wording)", () => {
    const result = buildZeroResultsSummary(ctx({ results: "0", cpr: "—", resultsNum: 0, hasResults: false }));
    expect(result).toBe(
      "This campaign is active but recorded no purchases this week, with ₹1,050 spent reaching 12,600 people " +
        "across 45,000 impressions. The campaign is in the optimisation phase and performance is expected to " +
        "improve as the algorithm learns.",
    );
    expect(result.endsWith(".")).toBe(true);
  });

  it("never mentions CPR — the exact malformed-phrase bug this fix targets ('at a — cost')", () => {
    const result = buildZeroResultsSummary(ctx({ results: "0", cpr: "—", resultsNum: 0, hasResults: false }));
    expect(result).not.toContain("—");
    expect(result).not.toContain("cost per PURCHASES");
  });
});

describe("buildPausedZeroResultsSummary (Fix 4)", () => {
  it("builds the exact wording from the spec, substituting real spend/reach/impressions", () => {
    const result = buildPausedZeroResultsSummary(ctx());
    expect(result).toBe(
      "This campaign was paused this week with no new results recorded. During the period ₹1,050 was spent " +
        "reaching 12,600 people across 45,000 impressions.",
    );
  });

  it("never mentions the result label or cost per result — safe for any objective, including REACH", () => {
    const result = buildPausedZeroResultsSummary(ctx({ resultLabel: "REACH", costLabel: "COST PER 1K REACH" }));
    expect(result).not.toContain("REACH");
    expect(result).not.toContain("recorded no");
  });
});

describe("buildPausedZeroResultsInsights (Fix 4)", () => {
  it("returns a fixed, always-complete paragraph that never claims zero spend", () => {
    const result = buildPausedZeroResultsInsights();
    expect(result).not.toContain("no spend");
    expect(result.endsWith(".")).toBe(true);
  });
});

describe("resultCountMismatch (Fix 2)", () => {
  it("flags a stated result count more than 10% off the real count", () => {
    expect(resultCountMismatch("This campaign generated 35 leads at $40 cost per lead.", 5)).toBe(true);
  });

  it("does not flag a stated count within 10% of the real count", () => {
    expect(resultCountMismatch("This campaign generated 21 purchases at ₹50 cost per purchase.", 21)).toBe(false);
    expect(resultCountMismatch("This campaign generated 22 purchases at ₹50 cost per purchase.", 21)).toBe(false);
  });

  it("ignores currency amounts and percentages, only matching the first plain integer", () => {
    // $1,050 (currency) should never be mistaken for the result count.
    expect(resultCountMismatch("Spending $1,050 this week, the campaign generated 21 purchases.", 21)).toBe(false);
  });

  it("does not flag a response with no plain integer at all (other checks handle malformed responses)", () => {
    expect(resultCountMismatch("Performance was strong this week across the board.", 21)).toBe(false);
  });

  it("treats any nonzero stated count as a mismatch when the real count is exactly 0", () => {
    expect(resultCountMismatch("This campaign generated 3 purchases this week.", 0)).toBe(true);
  });
});

// A REACH/AWARENESS campaign has no conversion objective — resultLabel is
// "REACH", costLabel is "COST PER 1K REACH", and `results`/`resultsNum` are
// structurally always 0 (Meta doesn't populate a results count for pure
// awareness campaigns). The reported bug: a Reach campaign's summary
// incorrectly opened with "This campaign recorded no purchases at $0 cost
// per purchase" — every function below must never mention results,
// purchases, leads, or link clicks for a Reach campaign, and must use the
// dedicated reach/impressions/frequency/CPM template instead.
function reachCtx(overrides: Partial<AiContext> = {}): AiContext {
  return ctx({
    resultLabel: "REACH",
    costLabel: "COST PER 1K REACH",
    results: "0",
    resultsNum: 0,
    hasResults: false,
    cpr: "₹4.20", // Reach's own COST PER 1K REACH — deliberately NOT reused by the reach template, which uses cpm instead
    cpm: "₹18.50",
    freq: 1.8,
    ...overrides,
  });
}

describe("Reach/Awareness campaigns — never mention results, purchases, leads, or conversions", () => {
  describe("buildSummaryPrompt", () => {
    it("switches to the Reach-specific prompt, with the explicit instruction line, when resultLabel is REACH", () => {
      const prompt = buildSummaryPrompt(reachCtx());
      expect(prompt).toContain(
        "This is a REACH/AWARENESS campaign. Do NOT mention results, purchases, leads or conversions. Focus only on reach, impressions, frequency, CPM, CTR and CPC.",
      );
      expect(prompt).not.toContain("primary result count and label");
      expect(prompt).not.toContain("47 website leads, 312 link clicks, 5 purchases");
    });

    it("substitutes reach/impressions/CPM/frequency/CTR/CPC in the Data line — never the result/cost-per-result tokens", () => {
      const prompt = buildSummaryPrompt(reachCtx());
      expect(prompt).toContain(
        "Data: Campaign: Shoes - Purchases, Date: Jul 13 - Jul 19, Spend: ₹1,050, Reach: 12,600, Impressions: 45,000, CPM: ₹18.50, Frequency: 1.8x, CTR: 2.00%, CPC: ₹3.50",
      );
      expect(prompt).not.toContain("REACH: 0");
      expect(prompt).not.toContain("COST PER 1K REACH: ₹4.20");
    });

    it("still uses the generic prompt for a non-Reach objective (e.g. PURCHASES)", () => {
      const prompt = buildSummaryPrompt(ctx());
      expect(prompt).not.toContain("REACH/AWARENESS campaign");
      expect(prompt).toContain("Sentence 1 must mention ALL of these in order:");
    });
  });

  describe("buildZeroResultsSummary", () => {
    it("uses the fixed reach template instead of 'recorded no REACH' or any conversion wording", () => {
      const result = buildZeroResultsSummary(reachCtx());
      expect(result).toBe(
        "This campaign reached 12,600 people with 45,000 impressions at a ₹18.50 CPM, maintaining a 1.8x " +
          "average frequency. The campaign achieved a 2.00% click-through rate at ₹3.50 cost per click, " +
          "reflecting current audience engagement levels.",
      );
      expect(result).not.toContain("recorded no");
      expect(result).not.toContain("purchase");
      expect(result).not.toContain("REACH");
      expect(result).not.toContain("result");
    });
  });

  describe("buildFallbackSummary", () => {
    it("uses the fixed reach template instead of 'generated 0 REACH at ... COST PER 1K REACH'", () => {
      const result = buildFallbackSummary(reachCtx());
      expect(result).toBe(
        "This campaign reached 12,600 people with 45,000 impressions at a ₹18.50 CPM, maintaining a 1.8x " +
          "average frequency. The campaign achieved a 2.00% click-through rate at ₹3.50 cost per click, " +
          "reflecting current audience engagement levels.",
      );
      expect(result).not.toContain("generated");
      expect(result).not.toContain("purchase");
      expect(result).not.toContain("COST PER 1K REACH");
    });
  });

  it("never shows 'no purchases' for a non-purchase campaign — the fallback dynamically lower-cases whatever the real resultLabel is", () => {
    expect(buildZeroResultsSummary(ctx({ resultLabel: "WEBSITE LEADS", costLabel: "COST PER WEBSITE LEAD", results: "0", resultsNum: 0 }))).toContain(
      "recorded no website leads",
    );
    expect(buildZeroResultsSummary(ctx({ resultLabel: "LINK CLICKS", costLabel: "COST PER CLICK", results: "0", resultsNum: 0 }))).toContain(
      "recorded no link clicks",
    );
    expect(buildZeroResultsSummary(ctx({ resultLabel: "PURCHASES", costLabel: "COST PER PURCHASE", results: "0", resultsNum: 0 }))).toContain(
      "recorded no purchases",
    );
    expect(buildZeroResultsSummary(ctx({ resultLabel: "WEBSITE LEADS", results: "0", resultsNum: 0 }))).not.toContain("no purchases");
  });
});

describe("buildFallbackInsights", () => {
  it("builds the exact 3-part structure from real data, always ending in a period", () => {
    const result = buildFallbackInsights(ctx());
    expect(result).toBe(
      "This week Shoes - Purchases spent ₹1,050 reaching 12,600 people with a 2.00% CTR. " +
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
