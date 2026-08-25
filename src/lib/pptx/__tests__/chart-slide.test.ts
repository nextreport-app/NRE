import { describe, expect, it } from "vitest";
import { buildChartSlideXml, chunkChartCampaigns, CHART_CAMPAIGNS_PER_SLIDE } from "../chart-slide";
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
const EMPTY_RING = "9ca3af";
const TRACK_DARK = "1e293b";

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
  return {
    periodLabel: "MTD",
    campaigns,
    totalAllSpend: campaigns.reduce((sum, c) => sum + c.spend, 0),
    activeCampaignCount: campaigns.filter((c) => c.isActive).length,
    reportType: "WEEKLY",
    mtdMonthName: null,
    periodSubLabel: "",
    ...overrides,
  };
}

function chartTitleText(xml: string): string {
  return /<a:t>([^<]*)<\/a:t>/.exec(xml)![1];
}

/** 16pt-tall filled spend bars (cy=203200), excluding the grey/navy track behind each one. */
function campaignBarFillColors(xml: string): string[] {
  const tracks = new Set([TRACK_DARK, "e2e8f0"]);
  const shapes = xml.match(/<p:sp>(?:(?!<\/p:sp>)[\s\S])*?<\/p:sp>/g) ?? [];
  return shapes
    .filter((s) => s.includes('<a:prstGeom prst="rect">') && s.includes("<a:p/>") && s.includes('cy="203200"'))
    .map((s) => /<a:srgbClr val="([0-9a-fA-F]+)"\/>/.exec(s)![1].toLowerCase())
    .filter((c) => !tracks.has(c));
}

describe("chunkChartCampaigns", () => {
  it(`splits after ${CHART_CAMPAIGNS_PER_SLIDE} campaigns`, () => {
    const items = Array.from({ length: 10 }, (_, i) => i);
    expect(chunkChartCampaigns(items)).toEqual([items.slice(0, 8), items.slice(8)]);
  });

  it("keeps a single empty page when there are no campaigns", () => {
    expect(chunkChartCampaigns([])).toEqual([[]]);
  });
});

describe("buildChartSlideXml — horizontal spend bars", () => {
  it("does not draw donut ellipses", () => {
    const xml = buildChartSlideXml(buildChart([campaign("A"), campaign("B")]), "$", BACKGROUND);
    expect(xml).not.toContain('<a:prstGeom prst="ellipse">');
  });

  it("assigns the first 7 campaigns the documented palette, in index order", () => {
    const campaigns = PALETTE.map((_, i) => campaign(`Campaign ${i + 1}`));
    const xml = buildChartSlideXml(buildChart(campaigns), "$", BACKGROUND);
    expect(campaignBarFillColors(xml)).toEqual(PALETTE);
  });

  it("gives two campaigns with the same objective different colors, keyed off index not objective", () => {
    const campaigns = [campaign("A", { resLabel: "PURCHASES" }), campaign("B", { resLabel: "PURCHASES" })];
    const xml = buildChartSlideXml(buildChart(campaigns), "$", BACKGROUND);
    expect(campaignBarFillColors(xml)).toEqual([PALETTE[0], PALETTE[1]]);
  });

  it("cycles the palette after 7 campaigns on one slide", () => {
    const campaigns = Array.from({ length: 8 }, (_, i) => campaign(`Campaign ${i + 1}`));
    const xml = buildChartSlideXml(buildChart(campaigns), "$", BACKGROUND);
    const fills = campaignBarFillColors(xml);
    expect(fills.slice(0, 7)).toEqual(PALETTE);
    expect(fills[7]).toBe(PALETTE[0]);
  });

  it("keeps palette colors stable across a continuation page via colorStartIndex", () => {
    const all = Array.from({ length: 10 }, (_, i) => campaign(`Campaign ${i + 1}`));
    const page2 = buildChartSlideXml(buildChart(all.slice(8)), "$", BACKGROUND, false, "META", {
      continuation: true,
      colorStartIndex: 8,
    });
    expect(campaignBarFillColors(page2)).toEqual([PALETTE[8 % 7], PALETTE[9 % 7]]);
    expect(chartTitleText(page2)).toContain("continued from previous slide");
    expect(page2).toContain("In continuation from previous slide");
  });

  it("never uses the empty/grey color for a campaign with real spend", () => {
    const xml = buildChartSlideXml(
      buildChart([
        campaign("Purchases Co", { resLabel: "PURCHASES" }),
        campaign("App Installs Co", { resLabel: "APP INSTALLS" }),
      ]),
      "$",
      BACKGROUND,
    );
    expect(campaignBarFillColors(xml)).not.toContain(EMPTY_RING);
  });
});

describe("buildChartSlideXml — zero-spend campaign is grey", () => {
  it("fills a $0 campaign grey instead of its normal palette color", () => {
    const campaigns = [campaign("Real Spend Co", { spend: 100 }), campaign("Zero Spend Co", { spend: 0 })];
    const xml = buildChartSlideXml(buildChart(campaigns), "$", BACKGROUND);
    const fills = campaignBarFillColors(xml);
    expect(fills[0]).toBe(PALETTE[0]);
    expect(fills[1]).toBe(EMPTY_RING);
  });

  it("still gives a later real-spend campaign its own palette color", () => {
    const campaigns = [campaign("Zero Spend Co", { spend: 0 }), campaign("Real Spend Co", { spend: 250 })];
    const xml = buildChartSlideXml(buildChart(campaigns), "$", BACKGROUND);
    const fills = campaignBarFillColors(xml);
    expect(fills[0]).toBe(EMPTY_RING);
    expect(fills[1]).toBe(PALETTE[1]);
  });
});

describe("buildChartSlideXml — month-name chart title", () => {
  it("uses '[Month] Campaign Performance' for a Weekly report when a month name is available", () => {
    const xml = buildChartSlideXml(buildChart([campaign("A")], { reportType: "WEEKLY", mtdMonthName: "July" }), "$", BACKGROUND);
    expect(chartTitleText(xml)).toBe("July Campaign Performance");
  });

  it("uses '[Month] Campaign Performance' for a Monthly report", () => {
    const xml = buildChartSlideXml(buildChart([campaign("A")], { reportType: "MONTHLY", mtdMonthName: "July" }), "$", BACKGROUND);
    expect(chartTitleText(xml)).toBe("July Campaign Performance");
  });

  it("falls back to 'MTD CAMPAIGN PERFORMANCE' when no month name is available", () => {
    const xml = buildChartSlideXml(buildChart([campaign("A")], { reportType: "WEEKLY", mtdMonthName: null }), "$", BACKGROUND);
    expect(chartTitleText(xml)).toBe("MTD CAMPAIGN PERFORMANCE");
  });
});

describe("buildChartSlideXml — Fix 2: title and date range combined onto a single line", () => {
  function titleShape(xml: string): string {
    const shapes = xml.match(/<p:sp>(?:(?!<\/p:sp>)[\s\S])*?<\/p:sp>/g) ?? [];
    return shapes[0]!;
  }

  function titleFontSizePt(xml: string): number {
    return Number(/sz="(\d+)"/.exec(titleShape(xml))![1]) / 100;
  }

  it("combines the title and date range onto one line for a Weekly report", () => {
    const xml = buildChartSlideXml(
      buildChart([campaign("A")], { mtdMonthName: "August", periodSubLabel: "August 1 - August 10, 2026" }),
      "$",
      BACKGROUND,
    );
    expect(chartTitleText(xml)).toBe("August Campaign Performance: August 1 - August 10, 2026");
  });

  it("combines the title and 'Full Month [Year]' onto one line for a Monthly report", () => {
    const xml = buildChartSlideXml(
      buildChart([campaign("A")], { reportType: "MONTHLY", mtdMonthName: "July", periodSubLabel: "Full Month 2026" }),
      "$",
      BACKGROUND,
    );
    expect(chartTitleText(xml)).toBe("July Campaign Performance: Full Month 2026");
  });

  it("falls back to the bare '[Month] Campaign Performance' title when periodSubLabel is empty", () => {
    const xml = buildChartSlideXml(buildChart([campaign("A")], { mtdMonthName: "August", periodSubLabel: "" }), "$", BACKGROUND);
    expect(chartTitleText(xml)).toBe("August Campaign Performance");
  });

  it("keeps the title at 28pt regardless of whether the combined line includes a date range", () => {
    const withRange = buildChartSlideXml(
      buildChart([campaign("A")], { mtdMonthName: "August", periodSubLabel: "August 1 - August 10, 2026" }),
      "$",
      BACKGROUND,
    );
    const withoutRange = buildChartSlideXml(buildChart([campaign("A")], { mtdMonthName: "August", periodSubLabel: "" }), "$", BACKGROUND);
    expect(titleFontSizePt(withRange)).toBe(28);
    expect(titleFontSizePt(withoutRange)).toBe(28);
  });
});

describe("buildChartSlideXml — light template and platform labels", () => {
  it("uses dark-navy body text on the light template, with the shared muted-grey heading color", () => {
    const xml = buildChartSlideXml(buildChart([campaign("A")]), "$", BACKGROUND, true);
    expect(xml).toContain('srgbClr val="0D1B2E"');
    expect(xml).toContain('srgbClr val="94a3b8"');
  });

  it("keeps the amber inactive-indicator color on both templates", () => {
    const darkXml = buildChartSlideXml(buildChart([campaign("A", { statusIndicator: "Paused" })]), "$", BACKGROUND, false);
    const lightXml = buildChartSlideXml(buildChart([campaign("A", { statusIndicator: "Paused" })]), "$", BACKGROUND, true);
    expect(darkXml).toContain('srgbClr val="fbbf24"');
    expect(lightXml).toContain('srgbClr val="fbbf24"');
  });

  it("keeps 'AD SPEND' by default", () => {
    const xml = buildChartSlideXml(buildChart([campaign("A")]), "$", BACKGROUND);
    expect(xml).toContain("AD SPEND");
  });

  it("uses 'COST' instead of 'AD SPEND' when platform is GOOGLE", () => {
    const xml = buildChartSlideXml(buildChart([campaign("A")]), "$", BACKGROUND, false, "GOOGLE");
    expect(xml).toContain("COST");
    expect(xml).not.toContain("AD SPEND");
  });
});
