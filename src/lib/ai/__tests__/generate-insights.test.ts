import { describe, expect, it, vi } from "vitest";
import { generateInsights } from "../generate-insights";
import { callAI } from "../client";
import { slideAiKey } from "../../pptx/render";
import type { ReportData } from "../../nre/report-data";

vi.mock("../client", () => ({
  callAI: vi.fn(async (prompt: string) => `AI:${prompt.slice(0, 10)}`),
}));

const PAUSED_SUMMARY_TEXT =
  "This campaign was inactive during the reporting period with no spend, reach, or impressions recorded. The campaigns are currently paused pending further instructions. Performance data will resume once campaigns are reactivated.";
const PAUSED_INSIGHTS_TEXT =
  "Campaigns remained paused this week with no activity recorded. No optimisation actions were taken during this period. Once campaigns are reactivated, we will monitor performance closely and provide a full update in the following week's report.";

function makeReportData(opts: { campaignSpend?: number; adSetSpend?: number } = {}): ReportData {
  const campaignSpend = opts.campaignSpend ?? 100;
  const adSetSpend = opts.adSetSpend ?? 50;

  const campaignAi = {
    ctx: "Campaign A",
    spend: "$" + campaignSpend,
    reach: "1,000",
    results: "5",
    cpr: "$20.00",
    ctr: "1.00%",
    cpc: "$2.00",
    resultLabel: "LEADS",
    costLabel: "COST PER LEAD",
    freq: 2,
    resultsNum: 5,
    hasResults: true,
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
      },
    ],
    pausedMessage: null,
    chart: null,
    periodRow: { hasData: false, monthLabel: "—", spend: "—", reach: "—", impressions: "—", ctr: "—", cpc: "—", result1: "0", cpr1: "—", result2: "—", cpr2: "—", g1Label: "RESULTS", g1CprLabel: "CPR", g2Label: null, g2CprLabel: null },
    mtdRow: { hasData: false, monthLabel: "—", spend: "—", reach: "—", impressions: "—", ctr: "—", cpc: "—", result1: "0", cpr1: "—", result2: "—", cpr2: "—", g1Label: "RESULTS", g1CprLabel: "CPR", g2Label: null, g2CprLabel: null },
    tableHeaderLabels: { result1Label: "RESULTS", cpr1Label: "CPR", result2Label: "—", cpr2Label: "—" },
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
});
