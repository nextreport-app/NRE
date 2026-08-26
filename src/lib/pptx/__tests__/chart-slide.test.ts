import { describe, expect, it } from "vitest";
import {
  buildChartSlideXml,
  buildDonutSegments,
  chunkChartCampaigns,
  ringColorForCampaign,
  chartCampaignMetricLines,
} from "../chart-slide";
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
  it("uses MTD Overview in the title, not weekly wording", () => {
    const xml = buildChartSlideXml(buildChart([campaign("A")]), "$", BACKGROUND);
    expect(xml).toContain("August MTD Overview");
    expect(xml).toContain("Month-to-date performance");
  });

  it("renders four KPI tiles and a donut arc", () => {
    const xml = buildChartSlideXml(
      buildChart([campaign("A", { spend: 442 }), campaign("B", { spend: 321 })]),
      "C$",
      BACKGROUND,
    );
    expect(xml).toContain("MTD AD SPEND");
    expect(xml).toContain("PURCHASES");
    expect(xml).toContain('prst="pie"');
    expect(xml).toContain("TOTAL MTD");
    expect(xml).toContain("A  ·");
    expect(xml).toContain("B  ·");
  });

  it("uses pie wedges and a center cover instead of horizontal spend bars", () => {
    const xml = buildChartSlideXml(buildChart([campaign("A")]), "$", BACKGROUND);
    expect(xml).toContain('prst="pie"');
    expect(xml).not.toContain('cy="152400"');
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
