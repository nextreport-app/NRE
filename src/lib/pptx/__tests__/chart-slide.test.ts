import { describe, expect, it } from "vitest";
import {
  buildDonutSegments,
  CHART_OVERVIEW_MEDIA_FILE,
  CHART_OVERVIEW_REL_ID,
  chunkChartCampaigns,
  ringColorForCampaign,
  chartCampaignMetricLines,
} from "../chart-slide";
import { buildChartSlideBundle } from "../chart-slide-render";
import { buildMtdOverviewSvg } from "../chart-overview-svg";
import { projectChartSlideToShareChart } from "../../nre/share-chart-projection";
import type { ChartCampaignData, ChartSlideData } from "../../nre/report-data";
import type { TemplateBackgroundImage } from "../package";

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
      primaryResultsValue: "10",
      primaryResultsLabel: "PURCHASES",
      primaryCprValue: "$10.00",
      primaryCprLabel: "COST PER PURCHASE",
      budgetPctUsed: "19%",
      activeCampaignCount: campaigns.filter((c) => c.isActive).length,
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

describe("buildChartSlideXml — MTD overview (KPI + donut)", () => {
  it("slide XML embeds overview image; title lives in the SVG source", async () => {
    const bundle = await buildChartSlideBundle(buildChart([campaign("A")]), "$", BACKGROUND);
    expect(bundle.xml).toContain(`r:embed="${CHART_OVERVIEW_REL_ID}"`);
    const svg = buildMtdOverviewSvg(projectChartSlideToShareChart(buildChart([campaign("A")]), "$"));
    expect(svg).toContain("August MTD Overview");
    expect(svg).toContain("Month-to-date performance");
  });

  it("embeds browser-matching overview PNG instead of native OOXML chart shapes", async () => {
    const bundle = await buildChartSlideBundle(
      buildChart([campaign("A", { spend: 442 }), campaign("B", { spend: 321 })]),
      "C$",
      BACKGROUND,
    );
    expect(bundle.mediaPath).toBe(`ppt/media/${CHART_OVERVIEW_MEDIA_FILE}`);
    expect(bundle.xml).toContain(`r:embed="${CHART_OVERVIEW_REL_ID}"`);
    expect(bundle.mediaBytes[0]).toBe(0x89);
    expect(bundle.mediaBytes[1]).toBe(0x50);
    const svg = buildMtdOverviewSvg(
      projectChartSlideToShareChart(
        buildChart([campaign("A", { spend: 442 }), campaign("B", { spend: 321 })]),
        "C$",
      ),
    );
    expect(svg).toContain("MTD AD SPEND");
    expect(svg).toContain("PURCHASES");
    expect(svg).toContain("TOTAL MTD");
    expect(svg).toContain("A ·");
    expect(svg).toContain("B ·");
    expect(bundle.xml).not.toContain('prst="pie"');
  });

  it("buildMtdOverviewSvg includes title and KPI labels from share projection", () => {
    const chart = buildChart([campaign("A", { spend: 442 }), campaign("B", { spend: 321 })]);
    const svg = buildMtdOverviewSvg(projectChartSlideToShareChart(chart, "C$"));
    expect(svg).toContain("August MTD Overview");
    expect(svg).toContain("MTD AD SPEND");
    expect(svg).toContain("TOTAL MTD");
    expect(svg).toContain("A ·");
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
