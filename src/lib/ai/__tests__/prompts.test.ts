import { describe, expect, it } from "vitest";
import { buildInsightPrompt, buildSummaryPrompt, capInsights, capSummary } from "../prompts";
import type { AiContext } from "../../nre/report-data";

function ctx(overrides: Partial<AiContext> = {}): AiContext {
  return {
    ctx: "Shoes - Purchases (combined 2 ad sets)",
    spend: "₹1,050",
    reach: "12,600",
    results: "21",
    cpr: "₹50.00",
    ctr: "2.00%",
    cpc: "₹3.50",
    resultLabel: "PURCHASES",
    costLabel: "COST PER PURCHASE",
    freq: 2.5,
    resultsNum: 21,
    hasResults: true,
    ...overrides,
  };
}

describe("buildSummaryPrompt", () => {
  it("uses the has-results prompt and includes every metric", () => {
    const prompt = buildSummaryPrompt(ctx());
    expect(prompt).toContain("under 65 words");
    expect(prompt).toContain("Ad Spend, Reach, PURCHASES count, COST PER PURCHASE, CTR, and CPC");
    expect(prompt).toContain("Spend: ₹1,050, Reach: 12,600, PURCHASES: 21, COST PER PURCHASE: ₹50.00, CTR: 2.00%, CPC: ₹3.50");
    expect(prompt).toContain("Ad frequency: 2.5 impressions per person.");
    expect(prompt).not.toContain("creative fatigue"); // freq 2.5 is not > 3.5
  });

  it("uses the zero-results prompt when hasResults is false", () => {
    const prompt = buildSummaryPrompt(ctx({ hasResults: false }));
    expect(prompt).toContain("results are 0");
    expect(prompt).toContain("EXACTLY 2 short paragraphs");
    expect(prompt).toContain("Results: 0, Cost per Result: N/A");
    expect(prompt).toContain('NEVER use "outstanding", "exceptional"');
  });

  it("mentions creative fatigue above 3.5x frequency", () => {
    const prompt = buildSummaryPrompt(ctx({ freq: 4.2 }));
    expect(prompt).toContain("creative fatigue");
  });

  it("omits the frequency note entirely when freq is 0", () => {
    const prompt = buildSummaryPrompt(ctx({ freq: 0 }));
    expect(prompt).not.toContain("Ad frequency");
  });
});

describe("buildInsightPrompt", () => {
  it("includes the source's duplicated opening sentence verbatim", () => {
    const prompt = buildInsightPrompt(ctx());
    const occurrences = prompt.split("Write the Key Insights & Next Strategy section for a Meta Ads weekly report.").length - 1;
    expect(occurrences).toBe(2);
  });

  it("mentions high frequency as a creative refresh signal above 3.5x", () => {
    const prompt = buildInsightPrompt(ctx({ freq: 4.0 }));
    expect(prompt).toContain("creative refresh signal");
  });

  it("tells the model not to frame 0 results positively", () => {
    const prompt = buildInsightPrompt(ctx({ hasResults: false }));
    expect(prompt).toContain("do not frame this positively");
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
