import { describe, expect, it } from "vitest";
import { buildChartSlideXml } from "../chart-slide";
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
const GREY = "a0aec0";
const INNER_HOLE_COLOR = "0d1b2e";

function campaign(name: string, overrides: Partial<ChartCampaignData> = {}): ChartCampaignData {
  return {
    name,
    spend: 100,
    results: 10,
    cpr: 10,
    avgCtr: 1.5,
    resLabel: "PURCHASES", // deliberately an objective absent from the old TYPE_COLOR map
    cprLabel: "COST PER PURCHASE",
    isActive: true,
    statusIndicator: null,
    ...overrides,
  };
}

function buildChart(campaigns: ChartCampaignData[]): ChartSlideData {
  return {
    periodLabel: "MTD",
    campaigns,
    totalAllSpend: campaigns.reduce((sum, c) => sum + c.spend, 0),
    activeCampaignCount: campaigns.filter((c) => c.isActive).length,
  };
}

/** Every <a:srgbClr val="..."> fill color, in document order, belonging to an <a:prstGeom prst="ellipse"> shape (the donut rings + inner holes) — 2 per campaign: [ring, hole, ring, hole, ...]. */
function ellipseFillColors(xml: string): string[] {
  const shapes = xml.match(/<p:sp>(?:(?!<\/p:sp>)[\s\S])*?<\/p:sp>/g) ?? [];
  return shapes
    .filter((s) => s.includes('<a:prstGeom prst="ellipse">'))
    .map((s) => /<a:srgbClr val="([0-9a-fA-F]+)"\/>/.exec(s)![1]);
}

/**
 * Every <a:srgbClr val="..."> fill color belonging to the bottom
 * spend-proportion bar's rectangles specifically — there are two other
 * per-campaign rect() shapes in play (textBox's text-holding rects, and the
 * small 1pt divider line above the results count), so this narrows to
 * exactly the 8pt-tall bar segments by their EMU height (8pt = 101600 EMU),
 * not just "a rect with no text" (the divider line also has no text).
 */
function barSegmentColors(xml: string): string[] {
  const shapes = xml.match(/<p:sp>(?:(?!<\/p:sp>)[\s\S])*?<\/p:sp>/g) ?? [];
  return shapes
    .filter((s) => s.includes('<a:prstGeom prst="rect">') && s.includes("<a:p/>") && s.includes('cy="101600"'))
    .map((s) => /<a:srgbClr val="([0-9a-fA-F]+)"\/>/.exec(s)![1]);
}

describe("buildChartSlideXml — Fix 3: per-campaign donut ring colors", () => {
  it("assigns the first 7 campaigns the exact documented palette, in index order", () => {
    const campaigns = PALETTE.map((_, i) => campaign(`Campaign ${i + 1}`));
    const xml = buildChartSlideXml(buildChart(campaigns), "$", BACKGROUND);
    const rings = ellipseFillColors(xml).filter((_, i) => i % 2 === 0); // even indexes = rings, odd = holes
    expect(rings).toEqual(PALETTE);
  });

  it("gives two campaigns with the SAME objective (e.g. both Purchases) different colors, keyed off index not objective", () => {
    const campaigns = [campaign("A", { resLabel: "PURCHASES" }), campaign("B", { resLabel: "PURCHASES" })];
    const xml = buildChartSlideXml(buildChart(campaigns), "$", BACKGROUND);
    const rings = ellipseFillColors(xml).filter((_, i) => i % 2 === 0);
    expect(rings[0]).not.toBe(rings[1]);
    expect(rings).toEqual([PALETTE[0], PALETTE[1]]);
  });

  it("cycles back through the palette after 7 campaigns, never repeating a color on an adjacent one", () => {
    const campaigns = Array.from({ length: 10 }, (_, i) => campaign(`Campaign ${i + 1}`));
    const xml = buildChartSlideXml(buildChart(campaigns), "$", BACKGROUND);
    const rings = ellipseFillColors(xml).filter((_, i) => i % 2 === 0);

    expect(rings).toHaveLength(10);
    expect(rings.slice(0, 7)).toEqual(PALETTE);
    expect(rings[7]).toBe(PALETTE[0]); // 8th campaign wraps back to the start
    expect(rings[8]).toBe(PALETTE[1]);
    expect(rings[9]).toBe(PALETTE[2]);

    for (let i = 0; i < rings.length - 1; i++) {
      expect(rings[i]).not.toBe(rings[i + 1]);
    }
  });

  it("never uses the grey fallback color for a ring, regardless of objective", () => {
    const campaigns = [
      campaign("Purchases Co", { resLabel: "PURCHASES" }),
      campaign("App Installs Co", { resLabel: "APP INSTALLS" }),
      campaign("Video Co", { resLabel: "VIDEO VIEWS" }),
      campaign("Unrecognized Objective Co", { resLabel: "SOME BRAND NEW META EVENT" }),
    ];
    const xml = buildChartSlideXml(buildChart(campaigns), "$", BACKGROUND);
    const rings = ellipseFillColors(xml).filter((_, i) => i % 2 === 0);
    expect(rings).not.toContain(GREY);
  });

  it("keeps the inner hole a fixed dark color, never grey, regardless of ring color", () => {
    const campaigns = [campaign("A"), campaign("B"), campaign("C")];
    const xml = buildChartSlideXml(buildChart(campaigns), "$", BACKGROUND);
    const holes = ellipseFillColors(xml).filter((_, i) => i % 2 === 1);
    expect(holes).toEqual([INNER_HOLE_COLOR, INNER_HOLE_COLOR, INNER_HOLE_COLOR]);
    expect(holes).not.toContain(GREY);
  });

  it("colors each spend-proportion bar segment the same as its own campaign's ring", () => {
    const campaigns = [campaign("A"), campaign("B"), campaign("C")];
    const xml = buildChartSlideXml(buildChart(campaigns), "$", BACKGROUND);
    const rings = ellipseFillColors(xml).filter((_, i) => i % 2 === 0);
    const bars = barSegmentColors(xml);
    expect(bars).toEqual(rings);
  });
});
