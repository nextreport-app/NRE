import { describe, expect, it } from "vitest";
import type { ChartCampaignData, ChartSlideData } from "../report-data";
import { buildVisualChartSlideModel } from "../visual-chart-slide";
import { projectChartSlideToShareChart } from "../share-chart-projection";
import { buildMtdOverviewSlideXml } from "../../pptx/chart-slide-ooxml";
import { buildMtdOverviewSvg } from "../../pptx/chart-overview-svg";
import { resultBarLayout, MTD_VISUAL } from "../../pptx/chart-slide-layout";
import { buildGroupedDonutSvg } from "../../pptx/chart-grouped-donut-render";

function campaign(name: string, spend: number, results: number, resLabel = "LANDING PAGE VIEWS", cprLabel = "COST PER LANDING PAGE VIEW"): ChartCampaignData {
  return { name, spend, results, cpr: results ? spend / results * (resLabel === "REACH" || resLabel === "IMPRESSIONS" ? 1000 : 1) : 0, avgCtr: 1, resLabel, cprLabel, isActive: true, statusIndicator: null };
}
function chart(campaigns: ChartCampaignData[]): ChartSlideData {
  return {
    campaigns, totalAllSpend: campaigns.reduce((sum, c) => sum + c.spend, 0),
    activeCampaignCount: campaigns.length, periodLabel: "Last30", reportType: "WEEKLY", mtdMonthName: "October",
    periodSubLabel: "Sep 26 - Oct 25, 2026", actualPeriodDays: 30,
    snapshot: { mode: "single", mtdSpendFormatted: "$2,700", activeCampaignCount: campaigns.length,
      objectives: [], objectivesOmittedCount: 0, primaryResultsValue: "5,500", primaryResultsLabel: "LANDING PAGE VIEWS",
      primaryCprValue: "$0.49", primaryCprLabel: "COST PER LANDING PAGE VIEW", primarySpendFormatted: "$2,700" },
  };
}
const rows = [
  campaign("Example Tractor - DC - Traffic - Alpha", 600, 900),
  campaign("Example Tractor - DC - Traffic - Beta", 600, 800),
  campaign("Example Tractor - DC - Traffic - Gamma", 450, 850),
  campaign("Example Tractor - DC - Traffic - Delta", 450, 750),
  campaign("ExampleTractor_Traffic_September", 600, 2200),
];
const background = { blipXml: '<a:blip r:embed="rId1"/>', srcRectXml: "", offX: 0, offY: 0, extCx: 12192000, extCy: 6858000, mediaTarget: "../media/background.png" };

describe("client-readable chart identity and metric contracts", () => {
  it("aggregates repeated objectives into one slice while preserving campaign bars", () => {
    const model = buildVisualChartSlideModel(chart(rows), "$");
    expect(model.leftHeading).toBe("Spend by Objective");
    expect(model.resultBars.map(bar => bar.name)).toEqual(["September", "Alpha", "Gamma", "Beta", "Delta"]);
    for (const bar of model.resultBars) {
      expect(rows.map(row => row.name)).toContain(bar.fullName);
    }
    expect(model.groupedDonut!.reduce((sum, seg) => sum + seg.percentage, 0)).toBeCloseTo(100);
    expect(model.groupedDonut).toEqual([{ name: "Landing Page Views", color: model.groupedDonut![0].color, percentage: 100, spendLabel: "$2,700.00" }]);
    expect(model.groupedDonutCenterLabel).toBe("$2,700.00");
    expect(model.resultBars[0]).toMatchObject({ valueLabel: "2,200", barPct: 100, statLine: "$600.00 spend · $0.27 / view" });
    expect(model.resultBars[1].barPct).toBe(40);
    expect(model.summaryLine).toContain("5,500");
    expect(model.summaryLine).toContain("$0.49"); // 2,700 / 5,500, not an average of campaign costs.
  });

  it("keeps campaign identity and counts aligned across native dark/light PPT shapes and SVG", () => {
    const data = projectChartSlideToShareChart(chart(rows), "$");
    for (const output of [buildMtdOverviewSlideXml(data, background, false), buildMtdOverviewSlideXml(data, background, true), buildMtdOverviewSvg(data)]) {
      expect(output).toContain("SPEND BY OBJECTIVE");
      expect(output).toContain("1. September");
      expect(output).toContain("5. Delta");
      expect(output).toContain("2,200");
      expect(output).toContain("$2,700.00");
      expect(output).not.toContain("SPEND BY CAMPAIGN");
    }
  });

  it("uses spend as the explicit bar scale when campaign result types differ", () => {
    const model = buildVisualChartSlideModel(chart([
      campaign("Purchases", 200, 2, "PURCHASES", "COST PER PURCHASE"),
      campaign("Traffic", 100, 1000, "LINK CLICKS", "COST PER LINK CLICK"),
    ]), "$");
    expect(model.isMultiObjective).toBe(true);
    expect(model.panelSubheading).toContain("spend (different goals)");
    expect(model.resultBars[0]).toMatchObject({ name: "Purchases", valueLabel: "$200", barPct: 100 });
    expect(model.resultBars[1].barPct).toBe(50);
    expect(model.summaryLine).not.toContain("1,002");
    expect(model.summaryLine).not.toContain("Average");
  });

  it("retains source event identity even when a campaign name suggests a different goal", () => {
    const model = buildVisualChartSlideModel(chart([
      campaign("Traffic - Reach", 100, 5, "WEBSITE LEADS", "COST PER WEBSITE LEAD"),
      campaign("Other Leads", 100, 10, "WEBSITE LEADS", "COST PER WEBSITE LEAD"),
    ]), "$");
    expect(model.rightHeading).toContain("Website Leads");
    expect(model.panelSubheading).not.toContain("different goals");
    expect(model.resultBars.reduce((sum, bar) => sum + bar.resultCount, 0)).toBe(15);
  });

  it("includes campaigns outside the five bars in their objective total", () => {
    const model = buildVisualChartSlideModel(chart([...rows, campaign("Small A", 20, 2), campaign("Small B", 30, 3)]), "$");
    expect(model.resultBars).toHaveLength(5);
    expect(model.panelSubheading).toContain("Top 5 of 7");
    expect(model.groupedDonut).toHaveLength(1);
    expect(model.groupedDonut?.[0]).toMatchObject({ name: "Landing Page Views", spendLabel: "$2,750.00", percentage: 100 });
    expect(model.groupedDonut!.reduce((sum, seg) => sum + seg.percentage, 0)).toBeCloseTo(100);
  });

  it("combines repeated goals across all campaigns into three distinct spend slices", () => {
    const model = buildVisualChartSlideModel(chart([
      campaign("Form A", 100, 10, "META FORM LEADS"),
      campaign("Form B", 50, 2, "META FORM LEADS"),
      campaign("Web", 100, 3, "WEBSITE LEADS"),
      campaign("Buy", 50, 1, "PURCHASES"),
    ]), "$");
    expect(model.groupedDonut?.map(s => [s.name, s.percentage, s.spendLabel])).toEqual([
      ["Meta Form Leads", 50, "$150.00"],
      ["Website Leads", 100 / 300 * 100, "$100.00"],
      ["Purchases", 50 / 300 * 100, "$50.00"],
    ]);
  });

  it("keeps distinct event types and zero-result spend in the objective mix", () => {
    const model = buildVisualChartSlideModel(chart([
      campaign("No leads", 100, 0, "WEBSITE LEADS"),
      campaign("Form", 100, 5, "META FORM LEADS"),
      campaign("Video", 100, 20, "THRUPLAY"),
      campaign("Short video", 100, 200, "2 SECOND VIDEO VIEWS"),
    ]), "$");
    expect(model.groupedDonut).toHaveLength(4);
    expect(model.groupedDonut?.every(s => s.percentage === 25)).toBe(true);
    expect(model.groupedDonut?.map(s => s.name)).toContain("Website Leads");
  });

  it("groups excess objectives rather than losing their spend", () => {
    const model = buildVisualChartSlideModel(chart(Array.from({length: 7}, (_, i) =>
      campaign(`Campaign ${i}`, 10, 1, `GOAL ${i}`))), "$");
    expect(model.groupedDonut).toHaveLength(6);
    expect(model.groupedDonut?.at(-1)).toMatchObject({ name: "Other objectives (2)", spendLabel: "$20.00" });
    expect(model.groupedDonut!.reduce((sum, s) => sum + s.percentage, 0)).toBeCloseTo(100);
  });

  it("preserves fractional result counts and per-1,000 objective cost units", () => {
    const fractional = buildVisualChartSlideModel(chart([campaign("A", 45, 1.5, "PURCHASES", "COST PER PURCHASE"), campaign("B", 75, 2.5, "PURCHASES", "COST PER PURCHASE")]), "$");
    expect(fractional.resultBars.map(bar => bar.valueLabel)).toEqual(["2.5", "1.5"]);
    expect(fractional.summaryLine).toContain("$30.00");
    const reach = buildVisualChartSlideModel(chart([campaign("A", 20, 2000, "REACH", "COST PER 1K REACH"), campaign("B", 60, 3000, "REACH", "COST PER 1K REACH")]), "$");
    expect(reach.summaryLine).toContain("$16.00");
    const singleReach = buildVisualChartSlideModel(chart([campaign("Only reach", 20, 2000, "REACH", "COST PER 1K REACH")]), "$");
    expect(singleReach.summaryLine).toContain("$10.00");
  });

  it("reserves readable metric line height while keeping five bars inside the native slide panel", () => {
    const layout = resultBarLayout(5, true);
    expect(layout.metricsH).toBeGreaterThanOrEqual(Math.ceil(layout.metricsSizePt * 1.4) + 2);
    expect(layout.startY + 5 * layout.rowH).toBeLessThanOrEqual(MTD_VISUAL.panelY + MTD_VISUAL.panelH);
  });

  it("renders a visible full donut and an uncapped maximum bar for a single campaign", () => {
    const svg = buildGroupedDonutSvg({ segments: [{ name: "Only campaign", color: "5eb0ef", percentage: 100, spendLabel: "$10" }], centerLabel: "$10", panelTopY: 80, leftX: 52, leftW: 348, panelFill: "111f35" }).join("");
    expect(svg).toContain('stroke="#5eb0ef"');
    expect(svg).toContain("TOTAL SPEND");
    expect(buildVisualChartSlideModel(chart([campaign("Only campaign", 10, 20)]), "$").resultBars[0].barPct).toBe(100);
  });
});
