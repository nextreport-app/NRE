import { describe, expect, it, vi } from "vitest";
import { generateInsights, revalidateCachedInsights } from "../generate-insights";
import { callAI } from "../client";
import { slideAiKey } from "../../pptx/render";
import type { ReportData } from "../../nre/report-data";
import { buildFallbackInsights, buildFallbackSummary, buildPausedZeroResultsInsights, buildZeroResultsSummary } from "../prompts";

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

vi.mock("../client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../client")>();
  return {
    ...actual,
    callAI: vi.fn(DEFAULT_AI_MOCK),
  };
});

// Fix 4 — the paused-copy summary now substitutes real spend/reach/
// impressions rather than a fully fixed string; makeReportData's fixture
// always uses "1,000" reach / "2,000" impressions regardless of the spend
// override, so this helper reconstructs the exact expected text for a given
// spend string.
function pausedSummaryText(spend: string): string {
  return `This campaign was paused this week with no new results recorded. During the period ${spend} was spent reaching 1,000 people across 2,000 impressions.`;
}
const PAUSED_INSIGHTS_TEXT = buildPausedZeroResultsInsights();

function makeReportData(
  opts: {
    campaignSpend?: number;
    adSetSpend?: number;
    campaignResultsNum?: number;
    resultLabel?: string;
    campaignIsInactive?: boolean;
    adSetIsInactive?: boolean;
  } = {},
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
    cpm: "$50.00",
    resultLabel,
    costLabel: "COST PER LEAD",
    freq: 2,
    resultsNum: campaignResultsNum,
    hasResults: campaignResultsNum > 0,
    spendNum: campaignSpend,
    isInactive: opts.campaignIsInactive ?? false,
  };
  const adSetAi = {
    ...campaignAi,
    ctx: "Campaign A / Set 1",
    spend: "$" + adSetSpend,
    spendNum: adSetSpend,
    isInactive: opts.adSetIsInactive ?? false,
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
    mtdSpendTotal: 0,
  };
}

describe("generateInsights", () => {
  it("returns one AiCopy entry per campaign and ad-set slide, keyed consistently with slideAiKey", async () => {
    const data = makeReportData();
    const result = await generateInsights(data, { anthropicApiKey: "k" });

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

  describe("zero-spend detection (Fix 4)", () => {
    it("skips the AI call for a zero-spend campaign slide and uses the fixed paused-campaign copy", async () => {
      vi.mocked(callAI).mockClear();
      const data = makeReportData({ campaignSpend: 0 });
      const result = await generateInsights(data, { anthropicApiKey: "k" });

      const campaignCopy = result.get(slideAiKey(data.campaignSlides[0]))!;
      expect(campaignCopy.summary).toBe(pausedSummaryText("$0"));
      expect(campaignCopy.insights).toBe(PAUSED_INSIGHTS_TEXT);
      // The ad-set slide still has real spend — only the zero-spend
      // campaign slide's calls are skipped, not both.
      expect(vi.mocked(callAI)).toHaveBeenCalledTimes(2);
    });

    it("skips the AI call for a zero-spend ad-set slide and uses the fixed paused-campaign copy", async () => {
      vi.mocked(callAI).mockClear();
      const data = makeReportData({ adSetSpend: 0 });
      const result = await generateInsights(data, { anthropicApiKey: "k" });

      const adSetCopy = result.get(slideAiKey(data.adSetSlides[0]))!;
      expect(adSetCopy.summary).toBe(pausedSummaryText("$0"));
      expect(adSetCopy.insights).toBe(PAUSED_INSIGHTS_TEXT);
      expect(vi.mocked(callAI)).toHaveBeenCalledTimes(2); // the campaign slide's own 2 calls only
    });

    it("treats sub-cent spend (rounding dust) as zero too", async () => {
      vi.mocked(callAI).mockClear();
      const data = makeReportData({ campaignSpend: 0.0049 });
      const result = await generateInsights(data, { anthropicApiKey: "k" });

      const campaignCopy = result.get(slideAiKey(data.campaignSlides[0]))!;
      expect(campaignCopy.summary).toBe(pausedSummaryText("$0.0049"));
      expect(campaignCopy.insights).toBe(PAUSED_INSIGHTS_TEXT);
    });

    it("does not skip the AI call once spend is at or above the 1-cent threshold", async () => {
      vi.mocked(callAI).mockClear();
      const data = makeReportData({ campaignSpend: 0.01 });
      const result = await generateInsights(data, { anthropicApiKey: "k" });

      const campaignCopy = result.get(slideAiKey(data.campaignSlides[0]))!;
      expect(campaignCopy.summary).toContain("AI:");
      expect(campaignCopy.insights).toContain("AI:");
    });

    it("skips every AI call when both the campaign and its only ad set have zero spend", async () => {
      vi.mocked(callAI).mockClear();
      const data = makeReportData({ campaignSpend: 0, adSetSpend: 0 });
      const result = await generateInsights(data, { anthropicApiKey: "k" });

      expect(result.get(slideAiKey(data.campaignSlides[0]))!.summary).toBe(pausedSummaryText("$0"));
      expect(result.get(slideAiKey(data.adSetSlides[0]))!.summary).toBe(pausedSummaryText("$0"));
      expect(vi.mocked(callAI)).not.toHaveBeenCalled();
    });
  });

  describe("isInactive detection (Fix 4) — delivery-status-driven, independent of spend", () => {
    it("uses the paused template for a slide the CSV marks Paused/Inactive even with real, nonzero spend", async () => {
      vi.mocked(callAI).mockClear();
      const data = makeReportData({ campaignIsInactive: true, campaignResultsNum: 0 });
      const result = await generateInsights(data, { anthropicApiKey: "k" });

      const campaignCopy = result.get(slideAiKey(data.campaignSlides[0]))!;
      expect(campaignCopy.summary).toBe(pausedSummaryText("$100"));
      expect(campaignCopy.insights).toBe(PAUSED_INSIGHTS_TEXT);
      // Ad-set slide is unaffected (its own isInactive is false, and it
      // shares campaignResultsNum: 0, so it hits the active-zero-results
      // path instead — no AI call either, but a different template).
      expect(vi.mocked(callAI)).not.toHaveBeenCalled();
    });

    it("does NOT use the paused template when isInactive is true but the slide still has real results this week", async () => {
      vi.mocked(callAI).mockClear();
      const data = makeReportData({ campaignIsInactive: true, campaignResultsNum: 5 });
      const result = await generateInsights(data, { anthropicApiKey: "k" });

      const campaignCopy = result.get(slideAiKey(data.campaignSlides[0]))!;
      expect(campaignCopy.summary).toContain("AI:"); // normal AI flow, not the paused template
    });
  });

  describe("zero-results detection (Fix 6, extended by Fix 4)", () => {
    it("uses the deterministic active-zero-results summary, not the AI, for a slide with real spend but 0 results", async () => {
      vi.mocked(callAI).mockClear();
      const data = makeReportData({ campaignResultsNum: 0 });
      const result = await generateInsights(data, { anthropicApiKey: "k" });

      const campaignCopy = result.get(slideAiKey(data.campaignSlides[0]))!;
      expect(campaignCopy.summary).toBe(
        buildZeroResultsSummary(data.campaignSlides[0].ai),
      );
      expect(campaignCopy.summary).not.toContain("—"); // the exact malformed-phrase bug this fix targets
    });

    it("never calls the AI (for either summary or insights) on a zero-results slide", async () => {
      vi.mocked(callAI).mockClear();
      const data = makeReportData({ campaignResultsNum: 0 });
      const result = await generateInsights(data, { anthropicApiKey: "k" });

      const campaignCopy = result.get(slideAiKey(data.campaignSlides[0]))!;
      expect(campaignCopy.insights).not.toContain("AI:");
      // makeReportData's ad-set AI context spreads from the campaign's (only
      // overriding ctx/spend), so it's zero-results here too — every
      // summary AND insights call is skipped for both slides now (Fix 4).
      expect(vi.mocked(callAI)).not.toHaveBeenCalled();
    });

    it("does not treat a REACH-objective slide as zero-results — Reach legitimately has no results count", async () => {
      vi.mocked(callAI).mockClear();
      const data = makeReportData({ campaignResultsNum: 0, resultLabel: "REACH" });
      const result = await generateInsights(data, { anthropicApiKey: "k" });

      const campaignCopy = result.get(slideAiKey(data.campaignSlides[0]))!;
      expect(campaignCopy.summary).toContain("AI:"); // real AI call, not the zero-results template
    });

    it("zero spend still takes priority over zero results (paused copy wins)", async () => {
      vi.mocked(callAI).mockClear();
      const data = makeReportData({ campaignSpend: 0, campaignResultsNum: 0 });
      const result = await generateInsights(data, { anthropicApiKey: "k" });

      const campaignCopy = result.get(slideAiKey(data.campaignSlides[0]))!;
      expect(campaignCopy.summary).toBe(pausedSummaryText("$0"));
    });

    it("does not skip the AI call when results are real (not zero)", async () => {
      vi.mocked(callAI).mockClear();
      const data = makeReportData({ campaignResultsNum: 5 });
      const result = await generateInsights(data, { anthropicApiKey: "k" });

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
      const result = await generateInsights(data, { anthropicApiKey: "k" });
      const campaignCopy = result.get(slideAiKey(data.campaignSlides[0]))!;

      expect(campaignCopy.summary).toBe(buildFallbackSummary(data.campaignSlides[0].ai));
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
      const result = await generateInsights(data, { anthropicApiKey: "k" });
      const campaignCopy = result.get(slideAiKey(data.campaignSlides[0]))!;

      expect(campaignCopy.summary).toBe("AI summary sentence one. AI summary sentence two.");
      expect(campaignCopy.insights).toBe(buildFallbackInsights(data.campaignSlides[0].ai));

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
      const result = await generateInsights(data, { anthropicApiKey: "k" });
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
      const result = await generateInsights(data, { anthropicApiKey: "k" });
      const campaignCopy = result.get(slideAiKey(data.campaignSlides[0]))!;

      expect(campaignCopy.summary).toBe(buildFallbackSummary(data.campaignSlides[0].ai));
      expect(campaignCopy.insights).toBe(buildFallbackInsights(data.campaignSlides[0].ai));

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
      const result = await generateInsights(data, { anthropicApiKey: "k" });
      const campaignCopy = result.get(slideAiKey(data.campaignSlides[0]))!;

      expect(campaignCopy.summary).toBe(buildFallbackSummary(data.campaignSlides[0].ai));
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Final summary text for Campaign A was incomplete"),
      );

      warnSpy.mockRestore();
      vi.mocked(callAI).mockImplementation(DEFAULT_AI_MOCK);
    });
  });

  describe("result-count mismatch detection (Fix 2)", () => {
    it("forces the structured fallback when the AI's own summary opens with a result count that disagrees with the slide's real count by more than 10%", async () => {
      vi.mocked(callAI).mockImplementation(async (prompt: string) =>
        prompt.startsWith("Write a campaign performance summary")
          ? "This campaign generated 35 leads at $20.00 cost per lead. It performed well this week."
          : "AI insight sentence one. AI insight sentence two. AI insight sentence three.",
      );
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      // Fixture's real resultsNum is 5 (campaignResultsNum default) — 35 is
      // wildly outside 10% of that, exactly the reported "35 purchases" vs.
      // a slide reading a much lower real count bug.
      const data = makeReportData();
      const result = await generateInsights(data, { anthropicApiKey: "k" });
      const campaignCopy = result.get(slideAiKey(data.campaignSlides[0]))!;

      expect(campaignCopy.summary).not.toContain("35");
      expect(campaignCopy.summary).toBe(buildFallbackSummary(data.campaignSlides[0].ai));
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("result count mismatch"));

      warnSpy.mockRestore();
      vi.mocked(callAI).mockImplementation(DEFAULT_AI_MOCK);
    });

    it("keeps the AI's own summary when its stated result count is within 10% of the real count", async () => {
      vi.mocked(callAI).mockImplementation(async (prompt: string) =>
        prompt.startsWith("Write a campaign performance summary")
          ? "This campaign generated 5 leads at $20.00 cost per lead. It performed well this week."
          : "AI insight sentence one. AI insight sentence two. AI insight sentence three.",
      );

      const data = makeReportData();
      const result = await generateInsights(data, { anthropicApiKey: "k" });
      const campaignCopy = result.get(slideAiKey(data.campaignSlides[0]))!;

      expect(campaignCopy.summary).toBe("This campaign generated 5 leads at $20.00 cost per lead. It performed well this week.");

      vi.mocked(callAI).mockImplementation(DEFAULT_AI_MOCK);
    });
  });

  describe("platform: GOOGLE", () => {
    it("calls callAI with Google Ads-worded prompts, not Meta's, when data.platform is GOOGLE", async () => {
      vi.mocked(callAI).mockClear();
      const data = { ...makeReportData(), platform: "GOOGLE" as const };
      await generateInsights(data, { anthropicApiKey: "k" });

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


it("replaces an unsupported September recommendation in a November report with source-based copy", async () => {
  const data = makeReportData();
  for (const slide of [...data.campaignSlides, ...data.adSetSlides]) slide.ai.dateRange = "November 10 - November 16";
  vi.mocked(callAI).mockImplementation(async () => "Delivery produced 5 leads during November. Run a controlled comparison in September using identical creative.");
  try {
    const result = await generateInsights(data, { anthropicApiKey: "k" });
    for (const slide of [...data.campaignSlides, ...data.adSetSlides]) {
      const copy = result.get(slideAiKey(slide))!;
      expect(copy.summary).toBe(buildFallbackSummary(slide.ai));
      expect(copy.insights).toBe(buildFallbackInsights(slide.ai));
      expect(copy.insights).not.toContain("September");
    }
  } finally { vi.mocked(callAI).mockImplementation(DEFAULT_AI_MOCK); }
});


it("rejects claims of staying within an allocated budget when only actual spend is provided", async () => {
  const data = makeReportData();
  vi.mocked(callAI).mockResolvedValue("Delivery produced 5 leads within the allocated budget. Review the next period before changing creative.");
  try {
    const result = await generateInsights(data, { anthropicApiKey: "k" });
    expect(result.get(slideAiKey(data.campaignSlides[0]))!.summary).toBe(buildFallbackSummary(data.campaignSlides[0].ai));
  } finally { vi.mocked(callAI).mockImplementation(DEFAULT_AI_MOCK); }
});


it("rechecks cached preview commentary without changing valid copy or mutating the cache", () => {
  const data = makeReportData();
  const slide = data.campaignSlides[0];
  slide.ai.dateRange = "November 10 - November 16";
  const key = slideAiKey(slide);
  const saved = { summary: "Delivery stayed within the allocated budget.", insights: "Run a comparison in September." };
  const cache = new Map([[key, saved]]);
  const result = revalidateCachedInsights(data, cache);
  expect(result.get(key)).toEqual({ summary: buildFallbackSummary(slide.ai), insights: buildFallbackInsights(slide.ai) });
  expect(cache.get(key)).toBe(saved);
  const valid = { summary: "Delivery produced 5 leads. Compare the next period before changing spend.", insights: "A controlled test may clarify the next step. Review November delivery first." };
  expect(revalidateCachedInsights(data, new Map([[key, valid]])).get(key)).toEqual(valid);
});

it.each([
  "Click-through rate held steady at 2.72%, suggesting consistent audience engagement relative to spend efficiency.",
  "The retargeting campaign delivered 384 link clicks, indicating solid engagement with your returning audience.",
  "The ad set produced 366 link clicks, indicating solid engagement from the audience segment.",
  "CTR remained stable at 2.72%. Current results were recorded.",
])("replaces unsupported launch-review commentary in fresh and cached copy: %s", async (unsupported) => {
  const data = makeReportData();
  const slide = data.campaignSlides[0];
  slide.ai.dateRange = "November 12 - November 18";
  const key = slideAiKey(slide);
  vi.mocked(callAI).mockResolvedValue(unsupported);
  try {
    const fresh = (await generateInsights(data, {anthropicApiKey:"test"})).get(key)!;
    const cached = revalidateCachedInsights(data, new Map([[key,{summary:unsupported,insights:unsupported}]]));
    expect(fresh.summary).toBe(buildFallbackSummary(slide.ai));
    expect(fresh.insights).toBe(buildFallbackInsights(slide.ai));
    expect(cached.get(key)).toEqual({summary:buildFallbackSummary(slide.ai),insights:buildFallbackInsights(slide.ai)});
  } finally {vi.mocked(callAI).mockImplementation(DEFAULT_AI_MOCK)}
});

it("keeps a cautious future test without treating it as an observed trend",()=>{
  const data=makeReportData(),slide=data.campaignSlides[0],key=slideAiKey(slide);
  const copy={summary:"Delivery produced 5 leads at $20.00 per lead. CTR was 1.00%.",insights:"Test a different message next period to see whether engagement improves. Compare the results before changing spend."};
  expect(revalidateCachedInsights(data,new Map([[key,copy]])).get(key)).toEqual(copy);
});

it("keeps ad-set fallback results scoped to the ad set", async()=>{
  const data=makeReportData();data.adSetSlides[0].ai.entityLabel="ad set";
  const wrong="This campaign produced 5 leads. Click-through rate was 1.00%.";
  vi.mocked(callAI).mockResolvedValue(wrong);
  try {
    const copy=await generateInsights(data,{anthropicApiKey:"test"});
    expect(copy.get(slideAiKey(data.adSetSlides[0]))!.summary).toMatch(/^This ad set is running/);
    expect(vi.mocked(callAI).mock.calls.some(([prompt])=>prompt.includes("These figures describe this ad set"))).toBe(true);
  }finally{vi.mocked(callAI).mockImplementation(DEFAULT_AI_MOCK)}
});

it.each(["—", "", "N/A"])("keeps unavailable CTR out of fallback percentages: %s",ctr=>{
  const ctx={...makeReportData().campaignSlides[0].ai,ctr};
  for(const resultLabel of ["LEADS","REACH"]){
    const text=buildFallbackSummary({...ctx,resultLabel});
    expect(text).toContain("Click-through rate is unavailable.");
    expect(text).not.toContain("—%");expect(text).not.toContain("N/A%");
  }
  expect(buildFallbackSummary({...ctx,ctr:"0.00%"})).toContain("Click-through rate was 0.00%.");
});

it.each([
 "The 2.72% click-through rate suggests solid creative engagement; monitoring lead quality would validate campaign efficiency.",
 "This retargeting ad set drove 366 link clicks, maintaining solid click efficiency across the period.",
 "The 1.38% CTR suggests the audience remains responsive; monitor next period before scaling.",
 "This ad set generated 366 link clicks, indicating the audience is engaging with the messaging at a reasonable cost.",
 "The campaign delivered strong message engagement. The audience is highly responsive.",
 "The cost per click represents competitive acquisition cost. Continue the campaign.",
 "The CPL of $8.60 is reasonable. Continue the campaign.",
 "The CTR is unusually high at 2.72%. The results are promising.",
])("rejects benchmark-free judgments despite intervening modifiers: %s",async unsupported=>{
 const data=makeReportData();const slide=data.campaignSlides[0];slide.ai.dateRange="November 12 - November 18";const key=slideAiKey(slide);
 vi.mocked(callAI).mockResolvedValue(unsupported);
 try{
  const copy=await generateInsights(data,{anthropicApiKey:"test"});
  expect(copy.get(key)).toEqual({summary:buildFallbackSummary(slide.ai),insights:buildFallbackInsights(slide.ai)});
  expect(revalidateCachedInsights(data,new Map([[key,{summary:unsupported,insights:unsupported}]] )).get(key)).toEqual(copy.get(key));
  expect(vi.mocked(callAI).mock.calls.every(([prompt])=>prompt.includes("there is no benchmark for that judgment"))).toBe(true);
 }finally{vi.mocked(callAI).mockImplementation(DEFAULT_AI_MOCK)}
});

it("allows a measured rate and a conditional next-period test without an unsupported judgment",()=>{
 const data=makeReportData(),slide=data.campaignSlides[0],key=slideAiKey(slide);
 const copy={summary:"Delivery produced 5 leads at $20.00 per lead. Click-through rate was 1.00%.",insights:"Test a different message next period and measure its CTR. Compare the results before changing spend."};
 expect(revalidateCachedInsights(data,new Map([[key,copy]])).get(key)).toEqual(copy);
});

it("replaces quarter-wide commentary in fresh and cached copy for a November weekly report",async()=>{
 const data=makeReportData(),slide=data.campaignSlides[0];slide.ai.ctx="Retargeting - Q3 - AUG 2026";slide.ai.dateRange="November 12 - November 18";
 const wrong="This ad set drove 366 link clicks during the period, supporting retargeting traffic objectives across Q3. Cost per click averaged $0.33.";
 const key=slideAiKey(slide);vi.mocked(callAI).mockResolvedValue(wrong);
 try{
  const result=await generateInsights(data,{anthropicApiKey:"test"});
  expect(result.get(key)?.summary).toBe(buildFallbackSummary(slide.ai));
  expect(result.get(key)?.insights).toBe(buildFallbackInsights(slide.ai));
  expect(revalidateCachedInsights(data,new Map([[key,{summary:wrong,insights:wrong}]] )).get(key)).toEqual(result.get(key));
  expect(vi.mocked(callAI).mock.calls.every(([prompt])=>prompt.includes("only reporting period"))).toBe(true);
 }finally{vi.mocked(callAI).mockImplementation(DEFAULT_AI_MOCK)}
});

it.each([
 "This ad set drove 18 LINK CLICKS during the period, supporting awareness and consideration objectives through paid social reach. Cost per click came in at $0.10.",
 "This ad set generated 18 LINK CLICKS at $0.10 per click across a reach of 1,000 people, indicating the creative is driving qualified interest among the audience. Compare landing-page visits next period.",
 "This ad set generated 18 LINK CLICKS at $0.10 per click against modest reach of 1,664 impressions. Compare spend and result count next period.",
 "This ad set generated 18 LINK CLICKS at $0.10 per click. Compare the conversion rate and return on ad spend for these clicks against the next reporting period.",
])("keeps link-click commentary within the supplied objective: %s",async wrong=>{
 const data=makeReportData({resultLabel:"LINK CLICKS",campaignResultsNum:18});const slide=data.campaignSlides[0],key=slideAiKey(slide);vi.mocked(callAI).mockResolvedValue(wrong);
 try{
  const result=await generateInsights(data,{anthropicApiKey:"test"});
  expect(result.get(key)).toEqual({summary:buildFallbackSummary(slide.ai),insights:buildFallbackInsights(slide.ai)});
  expect(revalidateCachedInsights(data,new Map([[key,{summary:wrong,insights:wrong}]] )).get(key)).toEqual(result.get(key));
 }finally{vi.mocked(callAI).mockImplementation(DEFAULT_AI_MOCK)}
});


it("rejects the live API report's unsupported moderate-form-engagement claim in fresh and cached copy", async () => {
  const data = makeReportData({resultLabel:"META FORM LEADS",campaignResultsNum:44,campaignSpend:346.33});
  const slide=data.campaignSlides[0],key=slideAiKey(slide);
  Object.assign(slide.ai,{results:"44",cpr:"$7.87",reach:"6,226",impressions:"11,324",ctr:"2.82%",dateRange:"November 13 - November 19"});
  const wrong="The campaign generated 44 META FORM LEADS at $7.87 per lead across a 6,226-person reach, with 2.82% click-through rate indicating moderate form engagement. Test whether lead quality improves by refining the instant form's question order or field count in the next period to identify if submission friction is affecting downstream performance.";
  vi.mocked(callAI).mockResolvedValue(wrong);
  try {
    const expected={summary:buildFallbackSummary(slide.ai),insights:buildFallbackInsights(slide.ai)};
    expect((await generateInsights(data,{anthropicApiKey:"test"})).get(key)).toEqual(expected);
    expect(revalidateCachedInsights(data,new Map([[key,{summary:wrong,insights:wrong}]])).get(key)).toEqual(expected);
  } finally { vi.mocked(callAI).mockImplementation(DEFAULT_AI_MOCK); }
});


it("does not let ad CTR become a form-interaction metric even without an adjective", () => {
  const data=makeReportData({resultLabel:"META FORM LEADS",campaignResultsNum:44});
  const slide=data.campaignSlides[0],key=slideAiKey(slide);
  const wrong="The campaign generated 44 META FORM LEADS. Click-through rate indicates form engagement.";
  expect(revalidateCachedInsights(data,new Map([[key,{summary:wrong,insights:wrong}]])).get(key)).toEqual({summary:buildFallbackSummary(slide.ai),insights:buildFallbackInsights(slide.ai)});
});
