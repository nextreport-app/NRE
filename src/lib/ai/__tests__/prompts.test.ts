import { describe, expect, it } from "vitest";
import {
  aiCopyViolatesObjectiveRules,
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
  it("asks for 2 sentences that interpret, without dumping every card metric", () => {
    const prompt = buildSummaryPrompt(ctx());
    expect(prompt).toContain(
      "Write a campaign performance summary for a Meta Ads weekly client report. Write exactly 2 sentences.",
    );
    expect(prompt).toContain("Do NOT re-list every card metric");
    expect(prompt).toContain('using the result label "PURCHASES" exactly as given');
    expect(prompt).toContain("- Use real numbers from the data — never invent or estimate");
    expect(prompt).toContain("- Keep total under 55 words");
    expect(prompt).not.toContain("Sentence 1 must mention ALL of these in order:");
  });

  it("substitutes every {token} in the Data line with the slide's real numbers", () => {
    const prompt = buildSummaryPrompt(ctx());
    expect(prompt).toContain(
      "Data: Campaign: Shoes - Purchases, Date: Jul 13 - Jul 19, Spend: ₹1,050, Reach: 12,600, Impressions: 45,000, PURCHASES: 21, COST PER PURCHASE: ₹50.00, CTR: 2.00%, CPC: ₹3.50, Frequency: 2.5x",
    );
  });

  it("includes frequency in the data line so insights can detect fatigue, but does not dump a card recipe", () => {
    const prompt = buildSummaryPrompt(ctx({ freq: 5 }));
    expect(prompt).toContain("Frequency: 5.0x");
    expect(prompt).not.toContain("Sentence 1 must mention ALL of these in order:");
  });

  it("produces the identical prompt regardless of hasResults — no separate zero-results branch", () => {
    const withResults = buildSummaryPrompt(ctx({ hasResults: true }));
    const withoutResults = buildSummaryPrompt(ctx({ hasResults: false }));
    expect(withResults).toBe(withoutResults);
  });
});

describe("buildInsightPrompt", () => {
  it("asks for exactly 2 sentences and bans the four-action laundry list", () => {
    const prompt = buildInsightPrompt(ctx());
    expect(prompt).toContain("Write the Key Insights section for a Meta Ads weekly client report. Write exactly 2 sentences.");
    expect(prompt).toContain("Sentence 1: One data read from the numbers");
    expect(prompt).toContain("Sentence 2: One next step that follows from that read");
    expect(prompt).toContain("FORBIDDEN: do not list four generic actions");
    expect(prompt).toContain("Do not start with This week or During this period — vary the opening");
    expect(prompt).toContain("Keep total length under 60 words");
    expect(prompt).not.toContain("exactly 3 sentences");
  });

  it("substitutes every {token} in the Data line — no Date or Impressions field here", () => {
    const prompt = buildInsightPrompt(ctx());
    expect(prompt).toContain(
      "Data: Campaign: Shoes - Purchases, Spend: ₹1,050, Reach: 12,600, PURCHASES: 21, COST PER PURCHASE: ₹50.00, CTR: 2.00%, CPC: ₹3.50, Frequency: 2.5x",
    );
    expect(prompt).not.toContain("Date:");
    expect(prompt).not.toContain("Impressions:");
  });

  it("includes frequency so a high-freq campaign can be called out as creative fatigue", () => {
    const prompt = buildInsightPrompt(ctx({ freq: 5 }));
    expect(prompt).toContain("Frequency: 5.0x");
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
      "This campaign is running for purchases and produced 21 purchases at ₹50.00 cost per purchase, on ₹1,050 " +
        "spend. Efficiency this period sits at a 2.00% CTR.",
    );
    expect(result.endsWith(".")).toBe(true);
    expect(result).not.toContain("During");
    expect(result).not.toContain("Shoes - Purchases");
  });

  it("never omits results and cost per result from sentence 1", () => {
    const result = buildFallbackSummary(ctx());
    const firstSentence = result.split(". ")[0];
    expect(firstSentence).toContain("21");
    expect(firstSentence).toContain("purchases");
    expect(firstSentence).toContain("₹50.00");
    expect(firstSentence).toContain("cost per purchase");
  });

  it("always includes total spend (previously missing from the fallback)", () => {
    const result = buildFallbackSummary(ctx());
    expect(result).toContain("on ₹1,050 spend");
  });

  it("never double-appends a percent sign, since ctx.ctr already carries its own '%'", () => {
    const result = buildFallbackSummary(ctx({ ctr: "0.35%" }));
    expect(result).toContain("sits at a 0.35% CTR");
    expect(result).not.toContain("0.35%%");
  });
});

describe("buildZeroResultsSummary", () => {
  it("builds the exact 2-sentence structure from real data, always ending in a period (Fix 4 wording)", () => {
    const result = buildZeroResultsSummary(ctx({ results: "0", cpr: "—", resultsNum: 0, hasResults: false }));
    expect(result).toBe(
      "This campaign is running for purchases but recorded none this week, with ₹1,050 spent. Check the conversion path (form, pixel, or landing page) before increasing spend.",
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
  it("returns client-facing copy that never claims zero spend", () => {
    const result = buildPausedZeroResultsInsights();
    expect(result).not.toContain("no spend");
    expect(result).not.toContain("do not invent");
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
        "This is a REACH/AWARENESS campaign. Do NOT mention results, purchases, leads or conversions.",
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
      expect(prompt).toContain("Sentence 1: What this campaign is for, using the result label \"PURCHASES\"");
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
      "running for website leads but recorded none",
    );
    expect(buildZeroResultsSummary(ctx({ resultLabel: "LINK CLICKS", costLabel: "COST PER CLICK", results: "0", resultsNum: 0 }))).toContain(
      "running for link clicks but recorded none",
    );
    expect(buildZeroResultsSummary(ctx({ resultLabel: "PURCHASES", costLabel: "COST PER PURCHASE", results: "0", resultsNum: 0 }))).toContain(
      "running for purchases but recorded none",
    );
    expect(buildZeroResultsSummary(ctx({ resultLabel: "WEBSITE LEADS", results: "0", resultsNum: 0 }))).not.toContain("purchases");
  });

  it("uses instant-form wording for META FORM LEADS — no pixel or landing page", () => {
    const result = buildZeroResultsSummary(
      ctx({ resultLabel: "META FORM LEADS", costLabel: "COST PER LEAD", results: "0", resultsNum: 0 }),
    );
    expect(result).toContain("Meta instant form leads");
    expect(result).not.toContain("pixel");
    expect(result).not.toContain("landing page");
  });
});

describe("buildFallbackInsights", () => {
  it("builds 2 sentences from real data, with one next step and no laundry list", () => {
    const result = buildFallbackInsights(ctx());
    expect(result).toBe(
      "Delivery produced 21 purchases at ₹50.00 on ₹1,050 spend. CTR is holding at 2.00% while cost per purchase is ₹50.00 — inspect the landing page before changing targeting.",
    );
    expect(result.endsWith(".")).toBe(true);
    expect(result).not.toContain("pausing underperformers");
    expect(result).not.toContain("testing new creatives");
  });

  it("calls out high frequency as creative fatigue", () => {
    const result = buildFallbackInsights(ctx({ freq: 4.2 }));
    expect(result).toContain("Frequency is 4.2x, so refresh creatives before adding budget.");
  });

  it("never double-appends a percent sign", () => {
    const result = buildFallbackInsights(ctx({ ctr: "0.35%" }));
    expect(result).not.toContain("0.35%%");
  });

  it("suggests instant-form review for META FORM LEADS with spend but no results", () => {
    const result = buildFallbackInsights(
      ctx({ resultLabel: "META FORM LEADS", costLabel: "COST PER LEAD", results: "0", resultsNum: 0 }),
    );
    expect(result.toLowerCase()).toContain("instant form");
    expect(result.toLowerCase()).not.toContain("pixel");
  });
});

describe("buildInsightPrompt — META FORM LEADS", () => {
  it("forbids pixel and landing page advice", () => {
    const prompt = buildInsightPrompt(ctx({ resultLabel: "META FORM LEADS", costLabel: "COST PER LEAD" }));
    expect(prompt).toContain("META INSTANT FORM LEADS");
    expect(prompt).toContain("FORBIDDEN: pixel");
    expect(prompt).not.toContain("check the form, pixel, or conversion setup");
  });
});

describe("aiCopyViolatesObjectiveRules", () => {
  it("flags pixel mentions for meta form leads", () => {
    expect(
      aiCopyViolatesObjectiveRules(
        "confirm the pixel is firing on completions",
        ctx({ resultLabel: "META FORM LEADS", costLabel: "COST PER LEAD" }),
      ),
    ).toBe(true);
    expect(aiCopyViolatesObjectiveRules("refresh the instant form fields", ctx({ resultLabel: "META FORM LEADS" }))).toBe(false);
  });
});
