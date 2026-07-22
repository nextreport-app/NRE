import { describe, expect, it, vi } from "vitest";
import { generateInsights } from "../generate-insights";
import { slideAiKey } from "../../pptx/render";
import type { ReportData } from "../../nre/report-data";

vi.mock("../client", () => ({
  callAI: vi.fn(async (prompt: string) => `AI:${prompt.slice(0, 10)}`),
}));

function makeReportData(): ReportData {
  const ai = {
    ctx: "Campaign A",
    spend: "$100",
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
        ai,
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
        ai,
      },
    ],
    pausedMessage: null,
    chart: null,
    periodRow: { hasData: false, monthLabel: "—", spend: "—", reach: "—", impressions: "—", ctr: "—", cpc: "—", result1: "0", cpr1: "—", result2: "—", cpr2: "—", g1Label: "RESULTS", g1CprLabel: "CPR", g2Label: null, g2CprLabel: null },
    mtdRow: { hasData: false, monthLabel: "—", spend: "—", reach: "—", impressions: "—", ctr: "—", cpc: "—", result1: "0", cpr1: "—", result2: "—", cpr2: "—", g1Label: "RESULTS", g1CprLabel: "CPR", g2Label: null, g2CprLabel: null },
    tableHeaderLabels: { result1Label: "RESULTS", cpr1Label: "CPR", result2Label: "—", cpr2Label: "—" },
    fileDateRange: "07/13/2026 to 07/19/2026",
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
});
