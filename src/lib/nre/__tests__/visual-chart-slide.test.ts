import { describe, expect, it } from "vitest";
import { buildVisualChartSlideModel } from "../visual-chart-slide";
import type { ChartCampaignData, ChartSlideData } from "../report-data";

function campaign(name: string, overrides: Partial<ChartCampaignData> = {}): ChartCampaignData {
  return {
    name,
    spend: 100,
    results: 10,
    cpr: 10,
    avgCtr: 1.5,
    resLabel: "PURCHASES",
    cprLabel: "COST PER PURCHASE",
    isActive: true,
    statusIndicator: null,
    ...overrides,
  };
}

function chart(overrides: Partial<ChartSlideData> = {}): ChartSlideData {
  return {
    periodLabel: "MTD",
    campaigns: [campaign("Alpha"), campaign("Beta", { spend: 50, results: 4 })],
    totalAllSpend: 150,
    activeCampaignCount: 2,
    snapshot: {
      mode: "single",
      mtdSpendFormatted: "$150",
      budgetPctUsed: "15%",
      activeCampaignCount: 2,
      objectives: [
        {
          label: "PURCHASES",
          resultsValue: "14",
          cprValue: "$10.71",
          cprLabel: "COST PER PURCHASE",
          spendFormatted: "$150",
        },
      ],
      objectivesOmittedCount: 0,
      primaryResultsValue: "14",
      primaryResultsLabel: "PURCHASES",
      primaryCprValue: "$10.71",
      primaryCprLabel: "COST PER PURCHASE",
      primarySpendFormatted: "$150",
    },
    reportType: "WEEKLY",
    mtdMonthName: "August",
    periodSubLabel: "August 1 - August 20, 2026",
    ...overrides,
  };
}

describe("buildVisualChartSlideModel", () => {
  it("builds campaign mini-donuts and result bars for single-objective accounts", () => {
    const model = buildVisualChartSlideModel(chart(), "$");
    expect(model.title).toBe("August Campaign Performance: August 1 - August 20, 2026");
    expect(model.isMultiObjective).toBe(false);
    expect(model.miniDonuts.length).toBe(2);
    expect(model.rightHeading).toContain("Purchases");
    expect(model.resultBars.length).toBe(2);
    expect(model.resultBars[0]!.resultCount).toBeGreaterThanOrEqual(model.resultBars[1]!.resultCount);
    expect(model.summaryLine).toContain("Total Spend");
  });

  it("groups by objective for multi-objective accounts", () => {
    const model = buildVisualChartSlideModel(
      chart({
        totalAllSpend: 3401,
        snapshot: {
          mode: "multi",
          mtdSpendFormatted: "$3,401",
          budgetPctUsed: "340%",
          activeCampaignCount: 2,
          objectives: [
            {
              label: "META FORM LEADS",
              resultsValue: "32",
              cprValue: "$88.26",
              cprLabel: "COST PER META FORM LEAD",
              spendFormatted: "$2,824",
            },
            {
              label: "WEBSITE LEADS",
              resultsValue: "0",
              cprValue: "N/A",
              cprLabel: "COST PER WEBSITE LEAD",
              spendFormatted: "$576",
            },
          ],
          objectivesOmittedCount: 0,
          primaryResultsValue: "32",
          primaryResultsLabel: "META FORM LEADS",
          primaryCprValue: "$88.26",
          primaryCprLabel: "COST PER META FORM LEAD",
          primarySpendFormatted: "$2,824",
        },
      }),
      "$",
    );
    expect(model.isMultiObjective).toBe(true);
    expect(model.miniDonuts).toHaveLength(0);
    expect(model.groupedDonut).toHaveLength(2);
    expect(model.resultBars).toHaveLength(2);
    expect(model.rightHeading).toBe("RESULTS BY OBJECTIVE");
    expect(model.summaryLine).toContain("|");
    expect(model.summaryLine).not.toContain("Budget Used");
  });
});
