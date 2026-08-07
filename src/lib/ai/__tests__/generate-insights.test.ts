import { describe, expect, it, vi } from "vitest";
import { generateInsights } from "../generate-insights";
import { callAI } from "../client";
import { slideAiKey } from "../../pptx/render";
import type { ReportData } from "../../nre/report-data";

// Realistic-shaped default: 2 sentence-endings for the summary prompt, 3 for
// the insights prompt — matching MIN_SUMMARY_SENTENCES/MIN_INSIGHTS_SENTENCES
// in generate-insights.ts, so the "real AI response, no fallback" path is
// actually exercised by tests that don't override this mock. Defined via
// vi.hoisted since vi.mock's factory is hoisted above normal top-level consts.
const { DEFAULT_AI_MOCK } = vi.hoisted(() => ({
  DEFAULT_AI_MOCK: (prompt: string) =>
    prompt.startsWith("Write a campaign performance summary")
      ? Promise.resolve(`AI:${prompt.slice(0, 10)} summary sentence one. AI summary sentence two.`)
      : Promise.resolve(`AI:${prompt.slice(0, 10)} insight sentence one. AI insight sentence two. AI insight sentence three.`),
}));

vi.mock("../client", () => ({
  callAI: vi.fn(DEFAULT_AI_MOCK),
}));

const PAUSED_SUMMARY_TEXT =
  "This campaign was inactive during the reporting period with no spend, reach, or impressions recorded. The campaign is currently paused pending further instructions.";
const PAUSED_INSIGHTS_TEXT =
  "The campaign remained inactive this week with no delivery or spend recorded. Once reactivated, budget will be directed toward top-performing creatives while underperformers are paused, with targeting refined to improve overall efficiency.";

function makeReportData(
  opts: { campaignSpend?: number; adSetSpend?: number; campaignResultsNum?: number; resultLabel?: string } = {},
): ReportData {
  const campaignSpend = opts.campaignSpend ?? 100;
  const adSetSpend = opts.adSetSpend ?? 50;
  const campaignResultsNum = opts.campaignResultsNum ?? 5;
  const resultLabel = opts.resultLabel ?? "LEADS";

  const campaignAi = {
    ctx: "Campaign A",
    dateRange: "Jul 13 - Jul 19",
    spend: "$" + campaignSpend,
    reach: "1,000",
    impressions: "2,000",
    results: campaignResultsNum > 0 ? String(campaignResultsNum) : "0",
    cpr: campaignResultsNum > 0 ? "$20.00" : "—",
    ctr: "1.00%",
    cpc: "$2.00",
    resultLabel,
    costLabel: "COST PER LEAD",
    freq: 2,
    resultsNum: campaignResultsNum,
    hasResults: campaignResultsNum > 0,
    spendNum: campaignSpend,
  };
  const adSetAi = {
    ...campaignAi,
    ctx: "Campaign A / Set 1",
    spend: "$" + adSetSpend,
    spendNum: adSetSpend,
  };

  return {
    isPaused: false,
    platform: "META",
    reportType: "WEEKLY",
    cover: {
      accountName: "Test",
      reportDate: "07-20-2026",
      dateRange: "Jul 13 - Jul 19",
      healthBadge: "ok",
      healthScore: 50,
      budgetSummary: "",
    },
    campaignSlides: [
      {
        kind: "campaign",
        campaignName: "Campaign A",
        resultLabel: "LEADS",
        costLabel: "COST PER LEAD",
        metrics: { spend: "$100", reach: "1,000", impressions: "2,000", results: "5", ctr: "1.00%", cpr: "$20.00", cpc: "$2.00" },
        dateRangeLine: "Jul 13 - Jul 19",
        avgFreq: 2,
        statusIndicator: null,
        ai: campaignAi,
        dynamicMetrics: [],
      },
    ],
    adSetSlides: [
      {
        kind: "adset",
        campaignName: "Campaign A",
        adSetName: "Set 1",
        resultLabel: "LEADS",
        costLabel: "COST PER LEAD",
        metrics: { spend: "$50", reach: "500", impressions: "1,000", results: "2", ctr: "1.00%", cpr: "$25.00", cpc: "$2.00" },
        dateRangeLine: "Jul 13 - Jul 19",
        rowFreq: 2,
        statusIndicator: null,
        ai: adSetAi,
        dynamicMetrics: [],
      },
    ],
    pausedMessage: null,
    chart: null,
    periodRow: { hasData: false, monthLabel: "—", fullMonthLabel: "—", monthName: null, sameMonthAsCurrentMTD: false, spend: "—", reach: "—", impressions: "—", ctr: "—", cpc: "—", resultColumns: [{ label: "RESULTS", costLabel: "COST PER RESULT", value: "0", cprValue: "—" }] },
    mtdRow: { hasData: false, monthLabel: "—", fullMonthLabel: "—", monthName: null, sameMonthAsCurrentMTD: false, spend: "—", reach: "—", impressions: "—", ctr: "—", cpc: "—", resultColumns: [{ label: "RESULTS", costLabel: "COST PER RESULT", value: "0", cprValue: "—" }] },
    tableHeaderLabels: { resultColumns: [{ label: "RESULTS", costLabel: "COST PER RESULT" }] },
    fileDateRange: "07/13/2026 to 07/19/2026",
    objectiveWarnings: [],
  };
}

describe("generateInsights", () => {
  it("returns one AiCopy entry per campaign and ad-set slide, keyed consistently with slideAiKey", async () => {
    const data = makeReportData();
    const result = await generateInsights(data, { groqApiKey: "k" });

    expect(result.size).toBe(2);
    expect(result.has(slideAiKey(data.campaignSlides[0]))).toBe(true);
    expect(result.has(slideAiKey(data.adSetSlides[0]))).toBe(true);

    const campaignCopy = result.get(slideAiKey(data.campaignSlides[0]))!;
    expect(campaignCopy.summary).toContain("AI:");
    expect(campaignCopy.insights).toContain("AI:");
  });

  it("returns an empty map for a paused report with no slides", async () => {
    const data = { ...makeReportData(), campaignSlides: [], adSetSlides: [] };
    const result = await generateInsights(data, {});
    expect(result.size).toBe(0);
  });

  describe("zero-spend detection", () => {
    it("skips the AI call for a zero-spend campaign slide and uses the fixed paused-campaign copy", async () => {
      vi.mocked(callAI).mockClear();
      const data = makeReportData({ campaignSpend: 0 });
      const result = await generateInsights(data, { groqApiKey: "k" });

      const campaignCopy = result.get(slideAiKey(data.campaignSlides[0]))!;
      expect(campaignCopy.summary).toBe(PAUSED_SUMMARY_TEXT);
      expect(campaignCopy.insights).toBe(PAUSED_INSIGHTS_TEXT);
      // The ad-set slide still has real spend — only the zero-spend
      // campaign slide's calls are skipped, not both.
      expect(vi.mocked(callAI)).toHaveBeenCalledTimes(2);
    });

    it("skips the AI call for a zero-spend ad-set slide and uses the fixed paused-campaign copy", async () => {
      vi.mocked(callAI).mockClear();
      const data = makeReportData({ adSetSpend: 0 });
      const result = await generateInsights(data, { groqApiKey: "k" });

      const adSetCopy = result.get(slideAiKey(data.adSetSlides[0]))!;
      expect(adSetCopy.summary).toBe(PAUSED_SUMMARY_TEXT);
      expect(adSetCopy.insights).toBe(PAUSED_INSIGHTS_TEXT);
      expect(vi.mocked(callAI)).toHaveBeenCalledTimes(2); // the campaign slide's own 2 calls only
    });

    it("treats sub-cent spend (rounding dust) as zero too", async () => {
      vi.mocked(callAI).mockClear();
      const data = makeReportData({ campaignSpend: 0.0049 });
      const result = await generateInsights(data, { groqApiKey: "k" });

      const campaignCopy = result.get(slideAiKey(data.campaignSlides[0]))!;
      expect(campaignCopy.summary).toBe(PAUSED_SUMMARY_TEXT);
      expect(campaignCopy.insights).toBe(PAUSED_INSIGHTS_TEXT);
    });

    it("does not skip the AI call once spend is at or above the 1-cent threshold", async () => {
      vi.mocked(callAI).mockClear();
      const data = makeReportData({ campaignSpend: 0.01 });
      const result = await generateInsights(data, { groqApiKey: "k" });

      const campaignCopy = result.get(slideAiKey(data.campaignSlides[0]))!;
      expect(campaignCopy.summary).toContain("AI:");
      expect(campaignCopy.insights).toContain("AI:");
    });

    it("skips every AI call when both the campaign and its only ad set have zero spend", async () => {
      vi.mocked(callAI).mockClear();
      const data = makeReportData({ campaignSpend: 0, adSetSpend: 0 });
      const result = await generateInsights(data, { groqApiKey: "k" });

      expect(result.get(slideAiKey(data.campaignSlides[0]))!.summary).toBe(PAUSED_SUMMARY_TEXT);
      expect(result.get(slideAiKey(data.adSetSlides[0]))!.summary).toBe(PAUSED_SUMMARY_TEXT);
      expect(vi.mocked(callAI)).not.toHaveBeenCalled();
    });
  });

  describe("zero-results detection (Fix 6)", () => {
    it("uses the deterministic zero-results summary, not the AI, for a slide with real spend but 0 results", async () => {
      vi.mocked(callAI).mockClear();
      const data = makeReportData({ campaignResultsNum: 0 });
      const result = await generateInsights(data, { groqApiKey: "k" });

      const campaignCopy = result.get(slideAiKey(data.campaignSlides[0]))!;
      expect(campaignCopy.summary).toBe(
        "During Jul 13 - Jul 19, the Campaign A campaign recorded no LEADS this week, with $100 spent " +
          "reaching 1,000 people across 2,000 impressions. The campaign maintained a 1.00% click-through rate " +
          "at $2.00 cost per click, with delivery active and results expected as the campaign optimises.",
      );
      expect(campaignCopy.summary).not.toContain("—"); // the exact malformed-phrase bug this fix targets
      // makeReportData's ad-set AI context spreads from the campaign's (only
      // overriding ctx/spend), so it's zero-results here too — both slides'
      // summary AI calls are skipped, insights AI calls still happen for
      // both: 2 calls total, not the usual 4.
      expect(vi.mocked(callAI)).toHaveBeenCalledTimes(2);
    });

    it("still calls the AI for the insights text on a zero-results slide", async () => {
      vi.mocked(callAI).mockClear();
      const data = makeReportData({ campaignResultsNum: 0 });
      const result = await generateInsights(data, { groqApiKey: "k" });

      const campaignCopy = result.get(slideAiKey(data.campaignSlides[0]))!;
      expect(campaignCopy.insights).toContain("AI:");
    });

    it("does not treat a REACH-objective slide as zero-results — Reach legitimately has no results count", async () => {
      vi.mocked(callAI).mockClear();
      const data = makeReportData({ campaignResultsNum: 0, resultLabel: "REACH" });
      const result = await generateInsights(data, { groqApiKey: "k" });

      const campaignCopy = result.get(slideAiKey(data.campaignSlides[0]))!;
      expect(campaignCopy.summary).toContain("AI:"); // real AI call, not the zero-results template
    });

    it("zero spend still takes priority over zero results (paused copy wins)", async () => {
      vi.mocked(callAI).mockClear();
      const data = makeReportData({ campaignSpend: 0, campaignResultsNum: 0 });
      const result = await generateInsights(data, { groqApiKey: "k" });

      const campaignCopy = result.get(slideAiKey(data.campaignSlides[0]))!;
      expect(campaignCopy.summary).toBe(PAUSED_SUMMARY_TEXT);
    });

    it("does not skip the AI call when results are real (not zero)", async () => {
      vi.mocked(callAI).mockClear();
      const data = makeReportData({ campaignResultsNum: 5 });
      const result = await generateInsights(data, { groqApiKey: "k" });

      const campaignCopy = result.get(slideAiKey(data.campaignSlides[0]))!;
      expect(campaignCopy.summary).toContain("AI:");
    });
  });

  describe("truncated AI response fallback", () => {
    it("replaces a summary that doesn't end with a period with the deterministic fallback sentence", async () => {
      vi.mocked(callAI).mockImplementation(async (prompt: string) =>
        prompt.startsWith("Write a campaign performance summary")
          ? "The campaign achieved a 4.48% click-through rate and a $2" // truncated mid-CPC
          : "AI insight sentence one. AI insight sentence two. AI insight sentence three.",
      );

      const data = makeReportData();
      const result = await generateInsights(data, { groqApiKey: "k" });
      const campaignCopy = result.get(slideAiKey(data.campaignSlides[0]))!;

      expect(campaignCopy.summary).toBe(
        "This campaign generated 5 LEADS at a $20.00 COST PER LEAD, reaching 1,000 people with 2,000 " +
          "impressions. Performance showed a 1.00% click-through rate at $2.00 cost per click, reflecting " +
          "current audience engagement levels.",
      );
      expect(campaignCopy.insights).toBe("AI insight sentence one. AI insight sentence two. AI insight sentence three.");

      vi.mocked(callAI).mockImplementation(DEFAULT_AI_MOCK);
    });

    it("replaces insights that don't end with a period with the deterministic fallback sentence", async () => {
      vi.mocked(callAI).mockImplementation(async (prompt: string) =>
        prompt.startsWith("Write the Key Insights")
          ? "Budget will shift toward top-performing ads while under"
          : "AI summary sentence one. AI summary sentence two.",
      );

      const data = makeReportData();
      const result = await generateInsights(data, { groqApiKey: "k" });
      const campaignCopy = result.get(slideAiKey(data.campaignSlides[0]))!;

      expect(campaignCopy.summary).toBe("AI summary sentence one. AI summary sentence two.");
      expect(campaignCopy.insights).toBe(
        "This week Campaign A spent $100 reaching 1,000 people with a 1.00% CTR. With 5 LEADS recorded, " +
          "the campaign shows developing traction at $20.00 per result. To maximise results, budget will shift " +
          "toward top-performing ads while underperformers are paused, with fresh creatives and refined targeting " +
          "planned for the coming week.",
      );

      vi.mocked(callAI).mockImplementation(DEFAULT_AI_MOCK);
    });

    it("treats a response ending in trailing whitespace after a period as complete, not truncated", async () => {
      vi.mocked(callAI).mockImplementation(async (prompt: string) =>
        prompt.startsWith("Write a campaign performance summary")
          ? "A complete sentence. Another complete sentence.   "
          : "A complete insight. Another complete insight. A third complete insight.   ",
      );
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const data = makeReportData();
      const result = await generateInsights(data, { groqApiKey: "k" });
      const campaignCopy = result.get(slideAiKey(data.campaignSlides[0]))!;

      expect(campaignCopy.summary).toBe("A complete sentence. Another complete sentence.");
      expect(warnSpy).not.toHaveBeenCalled();

      warnSpy.mockRestore();
      vi.mocked(callAI).mockImplementation(DEFAULT_AI_MOCK);
    });

    it("does not run the fallback text through capSummary/capInsights (it's already complete, capping could re-truncate it)", async () => {
      // The fallback sentence for this fixture easily exceeds the old
      // 220-char cap — if it were run through capSummary it could get cut at
      // a sentence boundary well before the end, defeating the whole point.
      vi.mocked(callAI).mockImplementation(async () => "truncated with no period");
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const data = makeReportData();
      const result = await generateInsights(data, { groqApiKey: "k" });
      const campaignCopy = result.get(slideAiKey(data.campaignSlides[0]))!;

      expect(campaignCopy.summary.endsWith("audience engagement levels.")).toBe(true);
      expect(campaignCopy.insights.endsWith("planned for the coming week.")).toBe(true);

      warnSpy.mockRestore();
      vi.mocked(callAI).mockImplementation(DEFAULT_AI_MOCK);
    });

    it("forces the structured fallback when a raw response passes the period check but still reads as fewer than the required complete sentences", async () => {
      // A response that DOES end with a period but is really only one
      // sentence (not the 2 the summary prompt asks for) must still be
      // caught by the final safety net, not just the raw "ends with a
      // period" check from step 1.
      vi.mocked(callAI).mockImplementation(async (prompt: string) =>
        prompt.startsWith("Write a campaign performance summary")
          ? "Only one sentence here."
          : "AI insight sentence one. AI insight sentence two. AI insight sentence three.",
      );
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const data = makeReportData();
      const result = await generateInsights(data, { groqApiKey: "k" });
      const campaignCopy = result.get(slideAiKey(data.campaignSlides[0]))!;

      expect(campaignCopy.summary.endsWith("audience engagement levels.")).toBe(true);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Final summary text for Campaign A was incomplete"),
      );

      warnSpy.mockRestore();
      vi.mocked(callAI).mockImplementation(DEFAULT_AI_MOCK);
    });
  });

  describe("platform: GOOGLE", () => {
    it("calls callAI with Google Ads-worded prompts, not Meta's, when data.platform is GOOGLE", async () => {
      vi.mocked(callAI).mockClear();
      const data = { ...makeReportData(), platform: "GOOGLE" as const };
      await generateInsights(data, { groqApiKey: "k" });

      const prompts = vi.mocked(callAI).mock.calls.map(([prompt]) => prompt);
      expect(prompts.length).toBeGreaterThan(0);
      for (const prompt of prompts) {
        // Fix 3 dropped the summary prompt's platform-name framing sentence
        // entirely (it no longer mentions either platform) — the insight
        // prompt is untouched and still says "Google Ads". Every prompt
        // must still never say "Meta Ads" regardless.
        expect(prompt).not.toContain("Meta Ads");
      }
      const insightPrompts = prompts.filter((p) => p.includes("Key Insights"));
      expect(insightPrompts.length).toBeGreaterThan(0);
      for (const prompt of insightPrompts) {
        expect(prompt).toContain("Google Ads");
      }
    });
  });
});
