import { describe, expect, it } from "vitest";
import {
  buildVisualChartSlideModel,
  formatDonutObjectiveLabel,
  formatGroupedDonutLegendEntry,
} from "../visual-chart-slide";
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
  it("formats grouped donut legend helper for legacy segments", () => {
    const line = formatGroupedDonutLegendEntry({
      name: "Alpha",
      percentage: 28.5,
      spendLabel: "$602",
    });
    expect(line).toBe("Alpha · 28.5% · $602");
  });

  it("uses spend donut + results bars when two or more campaigns report", () => {
    const model = buildVisualChartSlideModel(chart(), "$");
    expect(model.title).toBe("Last 30 Days Campaign Performance: Aug 1 - Aug 20, 2026");
    expect(model.isMultiObjective).toBe(false);
    expect(model.useSplitPanel).toBe(true);
    expect(model.groupedDonut).not.toBeNull();
    expect(model.leftHeading).toBe("Spend by Objective");
    expect(model.groupedDonut!.map((s) => s.name)).toEqual([
      formatDonutObjectiveLabel("PURCHASES"),
      formatDonutObjectiveLabel("PURCHASES"),
    ]);
    expect(model.rightHeading).toContain("Purchases");
    expect(model.resultBars.length).toBe(2);
    expect(model.resultBars[0]!.statLine).not.toContain("spend");
    expect(model.resultBars[0]!.statLine).toContain("% of total");
    expect(model.summaryLine).toContain("Total Spend");
  });

  it("uses cost per result wording for messaging conversations", () => {
    const model = buildVisualChartSlideModel(
      chart({
        totalAllSpend: 135,
        campaigns: [campaign("Messaging", { spend: 135, resLabel: "MESSAGING / CONVERSATIONS", cprLabel: "COST PER CONVERSATION", results: 3, cpr: 44.92 })],
        snapshot: {
          mode: "multi",
          mtdSpendFormatted: "$135",
          activeCampaignCount: 1,
          objectives: [
            {
              label: "MESSAGING / CONVERSATIONS",
              resultsValue: "3",
              cprValue: "$44.92",
              cprLabel: "COST PER CONVERSATION",
              spendFormatted: "$135",
            },
            {
              label: "META FORM LEADS",
              resultsValue: "0",
              cprValue: "N/A",
              cprLabel: "COST PER LEAD",
              spendFormatted: "$0",
            },
          ],
          objectivesOmittedCount: 0,
          primaryResultsValue: "3",
          primaryResultsLabel: "MESSAGING / CONVERSATIONS",
          primaryCprValue: "$44.92",
          primaryCprLabel: "COST PER CONVERSATION",
          primarySpendFormatted: "$135",
        },
      }),
      "$",
    );

    const msgBar = model.resultBars.find((b) => b.name === "Messaging / Conversations");
    expect(msgBar?.statLine).toContain("cost per result");
    expect(msgBar?.statLine).not.toContain("CP CONVE");
    expect(model.summaryLine).toContain("cost per result");
    expect(model.summaryLine).not.toContain("CP CONVE");
  });

  it("uses campaign split panel for multi-objective accounts with 2+ campaigns", () => {
    const model = buildVisualChartSlideModel(
      chart({
        totalAllSpend: 3400,
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
    expect(model.useSplitPanel).toBe(true);
    expect(model.groupedDonut).not.toBeNull();
    expect(model.resultBars).toHaveLength(2);
    expect(model.resultBars.map((b) => b.name)).toEqual(["Alpha", "Beta"]);
    expect(model.summaryLine).toContain("|");
    expect(model.summaryLine).not.toContain("Budget Used");
  });

  it("formats link-click CPC with cents on one stat line (not rounded to $0)", () => {
    const model = buildVisualChartSlideModel(
      chart({
        campaigns: [
          campaign("Traffic", {
            spend: 1921,
            results: 6626,
            cpr: 0.29,
            resLabel: "LINK CLICKS",
            cprLabel: "COST PER LINK CLICK",
          }),
        ],
        totalAllSpend: 1921,
        activeCampaignCount: 1,
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
    expect(linkBar!.statLine).toBe("$1,921 spend · 6,626 link clicks · $0.29 CPC · 12.8% of total");
    expect(linkBar!.statLine).not.toContain("\n");
    expect(linkBar!.costLine).toBe("$0.29 CPC");
  });

  it("scales objective-only bars proportionally to spend when a single campaign covers each objective", () => {
    const model = buildVisualChartSlideModel(
      chart({
        campaigns: [campaign("Account rollup")],
        totalAllSpend: 5780,
        activeCampaignCount: 1,
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

    expect(model.useSplitPanel).toBe(false);
    const byName = Object.fromEntries(model.resultBars.map((b) => [b.name, b.barPct]));
    expect(byName["Meta Form Leads"]).toBeGreaterThan(byName["Link Clicks"]!);
    expect(byName["Link Clicks"]).toBeGreaterThan(byName["Reach"]!);
    expect(byName["Meta Form Leads"]).toBe(100);
  });

  it("keeps full campaign names readable and avoids duplicate 100% bars for close results", () => {
    const names = [
      "Tractor - DC - Traffic Campaign",
      "Traffic - Tractor",
      "Traffic - UTV",
      "Traffic - CFMOTO",
      "Tractor_Traffic_September",
    ];
    const model = buildVisualChartSlideModel(
      chart({
        totalAllSpend: 2180,
        campaigns: names.map((name, index) =>
          campaign(name, {
            spend: [599, 598, 451, 450, 83][index]!,
            results: [2112, 1391, 1044, 825, 395][index]!,
            resLabel: "LANDING PAGE VIEWS",
            cprLabel: "COST PER LANDING PAGE VIEW",
            cpr: [0.28, 0.43, 0.43, 0.55, 0.21][index]!,
          }),
        ),
        snapshot: {
          mode: "single",
          mtdSpendFormatted: "$2,180",
          activeCampaignCount: 5,
          objectives: [
            {
              label: "LANDING PAGE VIEWS",
              resultsValue: "5,767",
              cprValue: "$0.38",
              cprLabel: "COST PER LANDING PAGE VIEW",
              spendFormatted: "$2,180",
            },
          ],
          objectivesOmittedCount: 0,
          primaryResultsValue: "5,767",
          primaryResultsLabel: "LANDING PAGE VIEWS",
          primaryCprValue: "$0.38",
          primaryCprLabel: "COST PER LANDING PAGE VIEW",
          primarySpendFormatted: "$2,180",
        },
      }),
      "$",
    );

    expect(model.resultBars.map((b) => b.name)).toEqual(names);
    expect(model.resultBars[0]!.barPct).toBe(100);
    expect(model.resultBars[1]!.barPct).toBeLessThan(100);
    expect(model.resultBars[0]!.spendLabel).toContain("599");
    expect(model.useSplitPanel).toBe(true);
    expect(model.resultBars[0]!.statLine).toContain("landing page views");
    expect(model.resultBars[0]!.statLine).toContain("% of total");
    expect(model.resultBars[0]!.statLine).not.toContain("spend");
  });

  it("single campaign uses spend donut + results bar — no share % on the bar", () => {
    const model = buildVisualChartSlideModel(
      chart({
        campaigns: [
          campaign("Legacy Campaign", {
            spend: 730,
            results: 4,
            resLabel: "WEBSITE LEADS",
            cprLabel: "COST PER LEAD",
            cpr: 182.5,
          }),
        ],
        totalAllSpend: 730,
      }),
      "C$",
    );
    expect(model.useSplitPanel).toBe(true);
    expect(model.groupedDonut).toHaveLength(1);
    expect(model.groupedDonut![0]!.percentage).toBe(100);
    expect(model.leftHeading).toBe("Spend by Objective");
    expect(model.resultBars[0]!.statLine).toBe("4 website leads · C$182.50 CPL");
    expect(model.resultBars[0]!.statLine).not.toContain("% of total");
    expect(model.resultBars[0]!.statLine).not.toContain("spend");
  });

  it("summary line shows fractional average CPC (not rounded to $0)", () => {
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
  });
});
