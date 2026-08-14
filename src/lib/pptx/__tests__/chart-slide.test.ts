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

/** The chart title textbox's own text — the first <a:t> in document order (see backgroundImage()'s own shape ordering: title is the first textBox pushed). */
function chartTitleText(xml: string): string {
  return /<a:t>([^<]*)<\/a:t>/.exec(xml)![1];
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

describe("buildChartSlideXml — month-name chart title (Weekly and Monthly alike)", () => {
  it("uses '[Month] Campaign Performance' for a Weekly report when a month name is available", () => {
    const xml = buildChartSlideXml(buildChart([campaign("A")], { reportType: "WEEKLY", mtdMonthName: "July" }), "$", BACKGROUND);
    expect(chartTitleText(xml)).toBe("July Campaign Performance");
  });

  it("uses '[Month] Campaign Performance' for a Monthly report", () => {
    const xml = buildChartSlideXml(buildChart([campaign("A")], { reportType: "MONTHLY", mtdMonthName: "July" }), "$", BACKGROUND);
    expect(chartTitleText(xml)).toBe("July Campaign Performance");
  });

  it("falls back to 'MTD CAMPAIGN PERFORMANCE' for a Weekly report with no month name available", () => {
    const xml = buildChartSlideXml(buildChart([campaign("A")], { reportType: "WEEKLY", mtdMonthName: null }), "$", BACKGROUND);
    expect(chartTitleText(xml)).toBe("MTD CAMPAIGN PERFORMANCE");
  });

  it("falls back to 'MTD CAMPAIGN PERFORMANCE' for a Monthly report with no month name available", () => {
    const xml = buildChartSlideXml(buildChart([campaign("A")], { reportType: "MONTHLY", mtdMonthName: null }), "$", BACKGROUND);
    expect(chartTitleText(xml)).toBe("MTD CAMPAIGN PERFORMANCE");
  });
});

describe("buildChartSlideXml — Fix 2: title and date range combined onto a single line", () => {
  /** The shape holding the title text — the first <p:sp> in document order. */
  function titleShape(xml: string): string {
    const shapes = xml.match(/<p:sp>(?:(?!<\/p:sp>)[\s\S])*?<\/p:sp>/g) ?? [];
    return shapes[0]!;
  }

  function titleFontSizePt(xml: string): number {
    return Number(/sz="(\d+)"/.exec(titleShape(xml))![1]) / 100;
  }

  it("combines the title and date range onto one line for a Weekly report: '[Month] Campaign Performance: [range]'", () => {
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

  it("falls back to the bare '[Month] Campaign Performance' title, with no ': ...' suffix, when periodSubLabel is empty", () => {
    const xml = buildChartSlideXml(buildChart([campaign("A")], { mtdMonthName: "August", periodSubLabel: "" }), "$", BACKGROUND);
    expect(chartTitleText(xml)).toBe("August Campaign Performance");
  });

  it("renders no separate sub-line shape at all — the 2nd <a:t> is always the pre-existing spend/campaign-count subtitle", () => {
    const xml = buildChartSlideXml(
      buildChart([campaign("A")], { mtdMonthName: "August", periodSubLabel: "August 1 - August 10, 2026" }),
      "$",
      BACKGROUND,
    );
    const matches = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)];
    expect(matches[1][1]).toContain("Total Month to Date Spend");
  });

  // Fix 1 (later round) — the title is always 28pt, matching every other
  // slide's own heading size, whether or not the combined line includes a
  // date range. It previously dropped to 16pt whenever a date-range
  // sub-line was present (i.e. almost every real report), which read as
  // visibly smaller than the rest of the deck instead of uniform.
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

describe("buildChartSlideXml — light template color awareness", () => {
  it("defaults to the dark-theme title/text and hole colors when isLightTemplate is omitted", () => {
    const xml = buildChartSlideXml(buildChart([campaign("A")]), "$", BACKGROUND);
    expect(xml).toContain('srgbClr val="FFFFFF"');
    const holes = ellipseFillColors(xml).filter((_, i) => i % 2 === 1);
    expect(holes).toEqual(["0d1b2e"]);
  });

  it("uses dark-navy body text, an amber heading, and a white card-colored hole when isLightTemplate is true", () => {
    const xml = buildChartSlideXml(buildChart([campaign("A")]), "$", BACKGROUND, true);
    expect(xml).toContain('srgbClr val="0D1B2E"');
    expect(xml).toContain('srgbClr val="C17D0A"');
    const holes = ellipseFillColors(xml).filter((_, i) => i % 2 === 1);
    expect(holes).toEqual(["FFFFFF"]);
  });

  it("gives only the chart title the heading accent color, not the body text", () => {
    const xml = buildChartSlideXml(buildChart([campaign("A")]), "$", BACKGROUND, true);
    expect(chartTitleText(xml)).toBe("MTD CAMPAIGN PERFORMANCE");
    const titleShape = /<p:sp>(?:(?!<\/p:sp>)[\s\S])*?MTD CAMPAIGN PERFORMANCE[\s\S]*?<\/p:sp>/.exec(xml)![0];
    expect(titleShape).toContain('srgbClr val="C17D0A"');
  });

  it("keeps the donut ring palette and the amber inactive-indicator color unchanged between templates", () => {
    const darkXml = buildChartSlideXml(buildChart([campaign("A", { statusIndicator: "Paused" })]), "$", BACKGROUND, false);
    const lightXml = buildChartSlideXml(buildChart([campaign("A", { statusIndicator: "Paused" })]), "$", BACKGROUND, true);
    const darkRings = ellipseFillColors(darkXml).filter((_, i) => i % 2 === 0);
    const lightRings = ellipseFillColors(lightXml).filter((_, i) => i % 2 === 0);
    expect(lightRings).toEqual(darkRings);
    expect(darkXml).toContain('srgbClr val="fbbf24"');
    expect(lightXml).toContain('srgbClr val="fbbf24"');
  });
});

describe("buildChartSlideXml — Google Ads label retexting", () => {
  it("keeps 'AD SPEND' inside the donut hole by default (platform omitted)", () => {
    const xml = buildChartSlideXml(buildChart([campaign("A")]), "$", BACKGROUND);
    expect(xml).toContain("AD SPEND");
  });

  it("uses 'COST' instead of 'AD SPEND' inside the donut hole when platform is GOOGLE", () => {
    const xml = buildChartSlideXml(buildChart([campaign("A")]), "$", BACKGROUND, false, "GOOGLE");
    expect(xml).toContain("COST");
    expect(xml).not.toContain("AD SPEND");
  });
});

const EMU_PER_PT = 12700;

/** The ring ellipse's own y offset in points, for the FIRST campaign column (every column shares the same y). */
function firstRingYPt(xml: string): number {
  const shapes = xml.match(/<p:sp>(?:(?!<\/p:sp>)[\s\S])*?<\/p:sp>/g) ?? [];
  const ring = shapes.find((s) => s.includes('<a:prstGeom prst="ellipse">'));
  const y = /<a:off x="\d+" y="(\d+)"\/>/.exec(ring!)![1];
  return Math.round(Number(y) / EMU_PER_PT);
}

describe("buildChartSlideXml — Fix 5: vertical centering", () => {
  // Mirrors the geometry buildChartSlideXml itself uses for every shape
  // below/around the donut circle (name label above, results/CPR labels
  // below) — see chart-slide.ts's own comment for where CIRCLE_D+152
  // comes from. Used here only to derive an expected CIRC_Y from a ring's
  // observed y (ring y = CIRC_Y + 18), not to re-implement the centering
  // math itself.
  function blockCenterPt(ringYPt: number, circleD: number): number {
    const circY = ringYPt - 18;
    const top = circY - 36;
    const bottom = circY + circleD + 116;
    return (top + bottom) / 2;
  }

  // The per-campaign block's own center happens to land near the slide's
  // true geometric center once title+subtitle+block+bar are all centered
  // as one unit (see the "whole content block" describe block below for
  // the actual top/bottom-margin symmetry check that matters) — this
  // constant is just where that block-only center falls out, not a design
  // target in itself.
  const CENTER_PT = 296;
  const TOLERANCE_PT = 5;

  it("centers the block in the space between the header and the bottom spend bar, for a small campaign count (max circle size)", () => {
    const xml = buildChartSlideXml(buildChart([campaign("A"), campaign("B")]), "$", BACKGROUND);
    // COL_W = floor((960 - 20*3) / 2) = 450 -> CIRCLE_D capped at 200.
    expect(Math.abs(blockCenterPt(firstRingYPt(xml), 200) - CENTER_PT)).toBeLessThan(TOLERANCE_PT);
  });

  it("centers the block for a large campaign count (small circle size) — no longer pinned to the small-count position", () => {
    const campaigns = Array.from({ length: 7 }, (_, i) => campaign(`Campaign ${i + 1}`));
    const xml = buildChartSlideXml(buildChart(campaigns), "$", BACKGROUND);
    // COL_W = floor((960 - 20*8) / 7) = 108 -> CIRCLE_D = 88.
    expect(Math.abs(blockCenterPt(firstRingYPt(xml), 88) - CENTER_PT)).toBeLessThan(TOLERANCE_PT);
  });

  it("moves the circle further down the slide as campaign count grows and circles shrink — the actual reported bug (content pinned near the top for larger decks)", () => {
    const twoUp = buildChartSlideXml(buildChart([campaign("A"), campaign("B")]), "$", BACKGROUND);
    const sevenUp = buildChartSlideXml(
      buildChart(Array.from({ length: 7 }, (_, i) => campaign(`Campaign ${i + 1}`))),
      "$",
      BACKGROUND,
    );
    expect(firstRingYPt(sevenUp)).toBeGreaterThan(firstRingYPt(twoUp));
  });
});

describe("buildChartSlideXml — whole content block (title through spend bar) is centered, both axes", () => {
  const SLIDE_H = 540;
  const SLIDE_W = 960;
  const BAR_H = 8;
  const MARGIN_TOLERANCE_PT = 1; // sub-point rounding from the pt->EMU->pt round trip only

  /** Every top-level <p:sp> in document order (background is a <p:pic>, excluded automatically). */
  function shapesOf(xml: string): string[] {
    return xml.match(/<p:sp>(?:(?!<\/p:sp>)[\s\S])*?<\/p:sp>/g) ?? [];
  }

  function offPt(shape: string): { xPt: number; yPt: number } {
    const m = /<a:off x="(-?\d+)" y="(-?\d+)"\/>/.exec(shape)!;
    return { xPt: Math.round(Number(m[1]) / EMU_PER_PT), yPt: Math.round(Number(m[2]) / EMU_PER_PT) };
  }

  /** The title is always the first shape pushed. */
  function titleTopPt(xml: string): number {
    return offPt(shapesOf(xml)[0]).yPt;
  }

  /** The spend-proportion bar segments: 8pt-tall rects (101600 EMU), same test signature as barSegmentColors() above. */
  function barBottomPt(xml: string): number {
    const bar = shapesOf(xml).find(
      (s) => s.includes('<a:prstGeom prst="rect">') && s.includes("<a:p/>") && s.includes('cy="101600"'),
    )!;
    return offPt(bar).yPt + BAR_H;
  }

  it("puts an equal empty margin above the title and below the spend bar, for a small campaign count", () => {
    const xml = buildChartSlideXml(buildChart([campaign("A"), campaign("B")]), "$", BACKGROUND);
    const topMargin = titleTopPt(xml);
    const bottomMargin = SLIDE_H - barBottomPt(xml);
    expect(Math.abs(topMargin - bottomMargin)).toBeLessThanOrEqual(MARGIN_TOLERANCE_PT);
  });

  it("puts an equal empty margin above the title and below the spend bar, for a large campaign count (smaller circles, shorter content block)", () => {
    const campaigns = Array.from({ length: 7 }, (_, i) => campaign(`Campaign ${i + 1}`));
    const xml = buildChartSlideXml(buildChart(campaigns), "$", BACKGROUND);
    const topMargin = titleTopPt(xml);
    const bottomMargin = SLIDE_H - barBottomPt(xml);
    expect(Math.abs(topMargin - bottomMargin)).toBeLessThanOrEqual(MARGIN_TOLERANCE_PT);
  });

  it("grows the top/bottom margins as campaign count shrinks the content block, instead of leaving the extra space unevenly at the bottom", () => {
    const twoUp = buildChartSlideXml(buildChart([campaign("A"), campaign("B")]), "$", BACKGROUND);
    const sevenUp = buildChartSlideXml(
      buildChart(Array.from({ length: 7 }, (_, i) => campaign(`Campaign ${i + 1}`))),
      "$",
      BACKGROUND,
    );
    // Fewer/bigger circles (2-up, CIRCLE_D=200) make a taller content block
    // than more/smaller circles (7-up, CIRCLE_D=88) -> the 2-up case's own
    // top margin must be smaller (less room to work with, same slide size).
    expect(titleTopPt(twoUp)).toBeLessThan(titleTopPt(sevenUp));
  });

  it("centers the row of circles horizontally — equal left/right margins around the first and last columns", () => {
    const xml = buildChartSlideXml(buildChart([campaign("A"), campaign("B"), campaign("C")]), "$", BACKGROUND);
    // n=3: COL_W = floor((960 - 20*4) / 3) = 293 -> CIRCLE_D capped at 200.
    const CIRCLE_D = 200;
    const rings = shapesOf(xml).filter((s) => s.includes('<a:prstGeom prst="ellipse">'));
    // Every other ellipse is the ring (even indexes); the alternating hole
    // fills the odd ones (see ellipseFillColors above) — take the rings.
    const ringOffs = rings.filter((_, i) => i % 2 === 0).map(offPt);
    const leftMargin = ringOffs[0].xPt; // circle isn't flush with its column edge, but symmetry is what matters
    const rightMargin = SLIDE_W - (ringOffs[ringOffs.length - 1].xPt + CIRCLE_D);
    expect(Math.abs(leftMargin - rightMargin)).toBeLessThanOrEqual(MARGIN_TOLERANCE_PT + 2);
  });
});
