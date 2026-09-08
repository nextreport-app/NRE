import { describe, expect, it } from "vitest";
import { buildVisualChartSlideModel, formatGroupedDonutLegendEntry } from "../visual-chart-slide";
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
    periodLabel: "Last30",
    campaigns: [campaign("Alpha"), campaign("Beta", { spend: 50, results: 4 })],
    totalAllSpend: 150,
    activeCampaignCount: 2,
    snapshot: {
      mode: "single",
      mtdSpendFormatted: "$150",
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
    periodSubLabel: "Aug 1 - Aug 20, 2026",
    ...overrides,
  };
}

describe("buildVisualChartSlideModel", () => {
  it("formats grouped donut legend as one row per campaign", () => {
    const model = buildVisualChartSlideModel(chart(), "$");
    const lines = model.groupedDonut!.map(formatGroupedDonutLegendEntry);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/1\. Alpha · .*% · \$/);
    expect(lines[1]).toMatch(/2\. Beta · .*% · \$/);
  });

  it("builds grouped spend donut and result bars for single-objective accounts", () => {
    const model = buildVisualChartSlideModel(chart(), "$");
    expect(model.title).toBe("Last 30 Days Campaign Performance: Aug 1 - Aug 20, 2026");
    expect(model.isMultiObjective).toBe(false);
    expect(model.miniDonuts).toHaveLength(0);
    expect(model.groupedDonut).toHaveLength(2);
    expect(model.rightHeading).toContain("Purchases");
    expect(model.resultBars.length).toBe(2);
    expect(model.resultBars[0]!.name).toBe("1. Alpha");
    expect(model.resultBars[0]!.barPct).toBe(100);
    expect(model.summaryLine).toContain("Total Spend");
  });

  it("groups by objective for multi-objective accounts", () => {
    const model = buildVisualChartSlideModel(
      chart({
        totalAllSpend: 3401,
        snapshot: {
          mode: "multi",
          mtdSpendFormatted: "$3,401",
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

  it("formats link-click CPC with cents on one stat line (not rounded to $0)", () => {
    const model = buildVisualChartSlideModel(
      chart({
        totalAllSpend: 1921,
        snapshot: {
          mode: "multi",
          mtdSpendFormatted: "$1,921",
          activeCampaignCount: 3,
          objectives: [
            {
              label: "REACH",
              resultsValue: "45,230",
              cprValue: "$0.04",
              cprLabel: "COST PER 1,000 PEOPLE REACHED",
              spendFormatted: "$1,200",
            },
            {
              label: "LINK CLICKS",
              resultsValue: "6,626",
              cprValue: "$0",
              cprLabel: "COST PER LINK CLICK",
              spendFormatted: "$1,921",
            },
            {
              label: "META FORM LEADS",
              resultsValue: "32",
              cprValue: "$60.03",
              cprLabel: "COST PER META FORM LEAD",
              spendFormatted: "$1,921",
            },
          ],
          objectivesOmittedCount: 0,
          primaryResultsValue: "6,626",
          primaryResultsLabel: "LINK CLICKS",
          primaryCprValue: "$0",
          primaryCprLabel: "COST PER LINK CLICK",
          primarySpendFormatted: "$1,921",
        },
      }),
      "$",
    );

    const linkBar = model.resultBars.find((b) => b.name === "Link Clicks");
    expect(linkBar).toBeDefined();
    expect(linkBar!.statLine).toBe("6,626 link clicks $0.29 CPC");
    expect(linkBar!.statLine).not.toContain("\n");
    expect(linkBar!.costLine).toBe("$0.29 CPC");
  });

  it("fills result bars proportionally to spend, not results count", () => {
    const model = buildVisualChartSlideModel(
      chart({
        totalAllSpend: 5780,
        snapshot: {
          mode: "multi",
          mtdSpendFormatted: "$5,780",
          activeCampaignCount: 3,
          objectives: [
            {
              label: "META FORM LEADS",
              resultsValue: "32",
              cprValue: "$90.91",
              cprLabel: "COST PER META FORM LEAD",
              spendFormatted: "$2,909",
            },
            {
              label: "LINK CLICKS",
              resultsValue: "6,626",
              cprValue: "$0.29",
              cprLabel: "COST PER LINK CLICK",
              spendFormatted: "$1,921",
            },
            {
              label: "REACH",
              resultsValue: "45,230",
              cprValue: "$0.02",
              cprLabel: "COST PER 1,000 PEOPLE REACHED",
              spendFormatted: "$950",
            },
          ],
          objectivesOmittedCount: 0,
          primaryResultsValue: "45,230",
          primaryResultsLabel: "REACH",
          primaryCprValue: "$0.02",
          primaryCprLabel: "COST PER 1,000 PEOPLE REACHED",
          primarySpendFormatted: "$2,909",
        },
      }),
      "$",
    );

    const byName = Object.fromEntries(model.resultBars.map((b) => [b.name, b.barPct]));
    expect(byName["Meta Form Leads"]).toBe(100);
    expect(byName["Link Clicks"]).toBeGreaterThan(byName["Reach"]!);
    expect(byName["Link Clicks"]).not.toBe(byName["Reach"]);
  });

  it("uses ranked short labels for long shared-prefix campaign names", () => {
    const names = [
      "Sherwood Tractor Sales | LPV Campaign A",
      "Sherwood Tractor Sales | LPV Campaign B",
      "Sherwood Tractor Parts | LPV Campaign C",
      "Sherwood Tractor Events | LPV Campaign D",
    ];
    const model = buildVisualChartSlideModel(
      chart({
        totalAllSpend: 2108,
        campaigns: names.map((name, index) =>
          campaign(name, {
            spend: [602, 600, 454, 452][index]!,
            results: [1593, 2387, 882, 1076][index]!,
            resLabel: "LANDING PAGE VIEWS",
            cprLabel: "COST PER LANDING PAGE VIEW",
            cpr: [0.38, 0.25, 0.51, 0.42][index]!,
          }),
        ),
        snapshot: {
          mode: "single",
          mtdSpendFormatted: "$2,108",
          activeCampaignCount: 4,
          objectives: [
            {
              label: "LANDING PAGE VIEWS",
              resultsValue: "5,938",
              cprValue: "$0.36",
              cprLabel: "COST PER LANDING PAGE VIEW",
              spendFormatted: "$2,108",
            },
          ],
          objectivesOmittedCount: 0,
          primaryResultsValue: "5,938",
          primaryResultsLabel: "LANDING PAGE VIEWS",
          primaryCprValue: "$0.36",
          primaryCprLabel: "COST PER LANDING PAGE VIEW",
          primarySpendFormatted: "$2,108",
        },
      }),
      "$",
    );

    expect(model.groupedDonut!.map((s) => s.name)).toEqual([
      "1. LPV Campaign A",
      "2. LPV Campaign B",
      "3. LPV Campaign C",
      "4. LPV Campaign D",
    ]);
    expect(model.resultBars.map((b) => b.name)).toEqual([
      "1. LPV Campaign A",
      "2. LPV Campaign B",
      "3. LPV Campaign C",
      "4. LPV Campaign D",
    ]);
    expect(model.resultBars[0]!.statLine).toContain("landing page views");
  });

  it("summary line shows fractional average CPC (not rounded to $0) and counts spend as active", () => {
    const model = buildVisualChartSlideModel(
      chart({
        totalAllSpend: 391,
        activeCampaignCount: 2,
        campaigns: [
          campaign("Traffic", {
            spend: 391,
            results: 1539,
            cpr: 0.25,
            resLabel: "LINK CLICKS",
            cprLabel: "COST PER LINK CLICK",
            isActive: true,
          }),
        ],
        snapshot: {
          mode: "single",
          mtdSpendFormatted: "$391",
          activeCampaignCount: 2,
          objectives: [
            {
              label: "LINK CLICKS",
              resultsValue: "1,539",
              cprValue: "$0.25",
              cprLabel: "COST PER LINK CLICK",
              spendFormatted: "$391",
            },
          ],
          objectivesOmittedCount: 0,
          primaryResultsValue: "1,539",
          primaryResultsLabel: "LINK CLICKS",
          primaryCprValue: "$0.25",
          primaryCprLabel: "COST PER LINK CLICK",
          primarySpendFormatted: "$391",
        },
      }),
      "$",
    );
    expect(model.summaryLine).toContain("Average Cost Per Link Clicks: $0.25");
    expect(model.summaryLine).not.toContain("$0 ·");
    expect(model.summaryLine).not.toContain("Active Campaign");
    expect(model.groupedDonut![0]!.color).toBe("f6ad55");
  });
});
