import { describe, expect, it } from "vitest";
import {
  buildDonutSegments,
  chunkChartCampaigns,
  ringColorForCampaign,
  chartCampaignMetricLines,
} from "../chart-slide";
import { buildChartSlideBundle } from "../chart-slide-render";
import { buildMtdOverviewSvg } from "../chart-overview-svg";
import { projectChartSlideToShareChart } from "../../nre/share-chart-projection";
import type { ChartCampaignData, ChartSlideData } from "../../nre/report-data";
import type { TemplateBackgroundImage } from "../package";
import { DONUT_HOLE_RATIO } from "../chart-slide-constants";

const BACKGROUND: TemplateBackgroundImage = {
  blipXml: '<a:blip r:embed="rId1"/>',
  srcRectXml: "",
  offX: 0,
  offY: 0,
  extCx: 12192000,
  extCy: 6858000,
  mediaTarget: "../media/background.png",
};

const PALETTE = ["f6ad55", "63b3ed", "68d391", "fc8181", "b794f4", "76e4f7", "f6e05e"];

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

function buildChart(campaigns: ChartCampaignData[], overrides: Partial<ChartSlideData> = {}): ChartSlideData {
  const total = campaigns.reduce((sum, c) => sum + c.spend, 0);
  return {
    periodLabel: "MTD",
    campaigns,
    totalAllSpend: total,
    activeCampaignCount: campaigns.filter((c) => c.isActive).length,
    snapshot: {
      mtdSpendFormatted: "$" + Math.round(total).toLocaleString("en-US"),
      mode: "single",
      primaryResultsValue: "10",
      primaryResultsLabel: "PURCHASES",
      primaryCprValue: "$10.00",
      primaryCprLabel: "COST PER PURCHASE",
      primarySpendFormatted: "$" + Math.round(total).toLocaleString("en-US"),
      budgetPctUsed: "19%",
      activeCampaignCount: campaigns.filter((c) => c.isActive).length,
      objectives: [
        {
          label: "PURCHASES",
          resultsValue: "10",
          cprValue: "$10.00",
          cprLabel: "COST PER PURCHASE",
          spendFormatted: "$" + Math.round(total).toLocaleString("en-US"),
        },
      ],
      objectivesOmittedCount: 0,
    },
    reportType: "WEEKLY",
    mtdMonthName: "August",
    periodSubLabel: "August 1 - August 24, 2026",
    ...overrides,
  };
}

describe("chunkChartCampaigns", () => {
  it("always returns a single page for the combined MTD overview slide", () => {
    const items = Array.from({ length: 10 }, (_, i) => i);
    expect(chunkChartCampaigns(items)).toEqual([items]);
  });
});

describe("buildDonutSegments", () => {
  it("groups campaigns beyond five into Other", () => {
    const campaigns = Array.from({ length: 7 }, (_, i) => campaign(`Campaign ${i + 1}`, { spend: 100 - i * 10 }));
    const segments = buildDonutSegments(campaigns, campaigns.reduce((s, c) => s + c.spend, 0));
    expect(segments).toHaveLength(6);
    expect(segments[5]?.name).toBe("Other");
  });

  it("assigns palette colors by original campaign index", () => {
    const campaigns = [campaign("A"), campaign("B")];
    const segments = buildDonutSegments(campaigns, 200);
    expect(segments[0]?.color).toBe(PALETTE[0]);
    expect(segments[1]?.color).toBe(PALETTE[1]);
  });
});

describe("buildChartSlideBundle — MTD overview (KPI + donut)", () => {
  it("slide XML uses native editable shapes with title text", async () => {
    const bundle = await buildChartSlideBundle(buildChart([campaign("A")]), "$", BACKGROUND);
    expect(bundle.xml).toContain("Month to date performance");
    expect(bundle.xml).toContain('prst="pie"');
    expect(bundle.xml).toContain("TOTAL SPEND");
    expect((bundle.xml.match(/<p:pic>/g) || []).length).toBe(1);
  });

  it("uses muted grey for the main heading — same REPORT_HEADER_COLOR as every other slide", async () => {
    const chart = buildChart([campaign("A", { spend: 442 })]);
    const shareChart = projectChartSlideToShareChart(chart, "$");
    const bundle = await buildChartSlideBundle(chart, "$", BACKGROUND);
    const titleIdx = bundle.xml.indexOf(`<a:t>${shareChart.title}</a:t>`);
    expect(titleIdx).toBeGreaterThan(-1);
    const runStart = bundle.xml.lastIndexOf("<a:r>", titleIdx);
    expect(bundle.xml.slice(runStart, titleIdx)).toContain('<a:srgbClr val="94a3b8"/>');
  });

  it("embeds native OOXML chart shapes instead of a rasterized PNG overlay", async () => {
    const bundle = await buildChartSlideBundle(
      buildChart([campaign("A", { spend: 442 }), campaign("B", { spend: 321 })]),
      "C$",
      BACKGROUND,
    );
    expect(bundle.xml).toContain("AD SPEND THIS MONTH");
    expect(bundle.xml).toContain("PURCHASES");
    expect(bundle.xml).toContain("of spend · C$442");
    expect(bundle.xml).toContain('txBox="1"');
    const svg = buildMtdOverviewSvg(
      projectChartSlideToShareChart(
        buildChart([campaign("A", { spend: 442 }), campaign("B", { spend: 321 })]),
        "C$",
      ),
    );
    expect(svg).toContain("AD SPEND THIS MONTH");
  });

  it("buildMtdOverviewSvg uses thinner donut hole ratio", () => {
    const chart = buildChart([campaign("A", { spend: 442 }), campaign("B", { spend: 321 })]);
    const svg = buildMtdOverviewSvg(projectChartSlideToShareChart(chart, "C$"));
    expect(svg).toContain(`A ${110 * DONUT_HOLE_RATIO}`);
  });

  it("buildMtdOverviewSvg uses muted grey for the main heading", () => {
    const chart = buildChart([campaign("A", { spend: 442 })]);
    const shareChart = projectChartSlideToShareChart(chart, "$");
    const svg = buildMtdOverviewSvg(shareChart);
    expect(svg).toContain('fill="#94a3b8"');
    expect(svg).toContain(shareChart.title);
  });

  it("renders a full-ring donut when one campaign owns 100% of spend", () => {
    const chart = buildChart([campaign("Only campaign", { spend: 500 })]);
    const svg = buildMtdOverviewSvg(projectChartSlideToShareChart(chart, "$"));
    const pathCount = (svg.match(/<path d="/g) || []).length;
    expect(pathCount).toBeGreaterThanOrEqual(2);
  });

  it("chartCampaignMetricLines still formats zero-result rows", () => {
    const lines = chartCampaignMetricLines(
      { ...campaign("Catalog"), spend: 45, results: 0, cpr: 0 },
      "C$",
    );
    expect(lines).toEqual({ resultsLine: "0 PURCHASES", cprLine: "N/A COST PER PURCHASE" });
  });

  it("ringColorForCampaign uses grey for zero spend", () => {
    expect(ringColorForCampaign(campaign("Zero", { spend: 0 }), 0)).toBe("9ca3af");
    expect(ringColorForCampaign(campaign("Real", { spend: 50 }), 1)).toBe(PALETTE[1]);
  });
});
