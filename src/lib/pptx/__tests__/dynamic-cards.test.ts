import { describe, it, expect } from "vitest";
import { buildDynamicCardShapes, DEFAULT_CARD_REGION, type CardMetric } from "../dynamic-cards";

const EMU_PER_PT = 12700;
// Shapes per card with no iconRelIds supplied: card background + icon badge
// circle + label textbox + value textbox (no <p:pic> without a resolved
// relationship id — see iconBadgeXml's doc comment).
const SHAPES_PER_CARD_NO_ICON = 4;

function offsetsOf(shapesXml: string[]): { xPt: number; yPt: number }[] {
  const offsets: { xPt: number; yPt: number }[] = [];
  for (const shape of shapesXml) {
    const m = shape.match(/<a:off x="(\d+)" y="(\d+)"\/>/);
    if (m) offsets.push({ xPt: Number(m[1]) / EMU_PER_PT, yPt: Number(m[2]) / EMU_PER_PT });
  }
  return offsets;
}

function metrics(n: number): CardMetric[] {
  return Array.from({ length: n }, (_, i) => ({
    key: `metric_${i + 1}`,
    label: `Metric ${i + 1}`,
    value: `${(i + 1) * 100}`,
    type: i === 0 ? "primary" : "secondary",
    format: "number",
  }));
}

// Every 4th shape (no icons) is a card background — its <a:off> gives the
// card's own top-left corner.
function cardOffsetsOf(shapes: string[]): { xPt: number; yPt: number }[] {
  return offsetsOf(shapes.filter((_, i) => i % SHAPES_PER_CARD_NO_ICON === 0));
}

describe("buildDynamicCardShapes — grid layout", () => {
  it("returns no shapes for an empty metric list", () => {
    expect(buildDynamicCardShapes([])).toEqual([]);
  });

  it("emits exactly 4 shapes per metric without icon relationships (card + icon badge + label + value)", () => {
    for (const n of [4, 5, 6, 7, 8, 9, 10, 11, 12]) {
      expect(buildDynamicCardShapes(metrics(n)).length).toBe(n * SHAPES_PER_CARD_NO_ICON);
    }
  });

  it("emits a 5th <p:pic> icon shape per metric when iconRelIds resolves one", () => {
    const shapes = buildDynamicCardShapes(metrics(1), { results: "rId99" });
    expect(shapes.length).toBe(5);
    expect(shapes.some((s) => s.startsWith("<p:pic>") && s.includes('r:embed="rId99"'))).toBe(true);
  });

  it("lays out 4 metrics as 2 columns x 2 rows", () => {
    const cardOffsets = cardOffsetsOf(buildDynamicCardShapes(metrics(4)));
    const distinctX = new Set(cardOffsets.map((o) => Math.round(o.xPt)));
    const distinctY = new Set(cardOffsets.map((o) => Math.round(o.yPt)));
    expect(distinctX.size).toBe(2);
    expect(distinctY.size).toBe(2);
  });

  it("lays out 6 metrics as 3 columns x 2 rows", () => {
    const cardOffsets = cardOffsetsOf(buildDynamicCardShapes(metrics(6)));
    const distinctX = new Set(cardOffsets.map((o) => Math.round(o.xPt)));
    const distinctY = new Set(cardOffsets.map((o) => Math.round(o.yPt)));
    expect(distinctX.size).toBe(3);
    expect(distinctY.size).toBe(2);
  });

  it("lays out 8 metrics as 4 columns x 2 rows", () => {
    const cardOffsets = cardOffsetsOf(buildDynamicCardShapes(metrics(8)));
    const distinctX = new Set(cardOffsets.map((o) => Math.round(o.xPt)));
    const distinctY = new Set(cardOffsets.map((o) => Math.round(o.yPt)));
    expect(distinctX.size).toBe(4);
    expect(distinctY.size).toBe(2);
  });

  it("lays out 10 metrics as 5 columns x 2 rows (Fix 3)", () => {
    const cardOffsets = cardOffsetsOf(buildDynamicCardShapes(metrics(10)));
    const distinctX = new Set(cardOffsets.map((o) => Math.round(o.xPt)));
    const distinctY = new Set(cardOffsets.map((o) => Math.round(o.yPt)));
    expect(distinctX.size).toBe(5);
    expect(distinctY.size).toBe(2);
  });

  it("lays out 12 metrics as 6 columns x 2 rows — the maximum, still a single slide (Fix 3)", () => {
    const cardOffsets = cardOffsetsOf(buildDynamicCardShapes(metrics(12)));
    const distinctX = new Set(cardOffsets.map((o) => Math.round(o.xPt)));
    const distinctY = new Set(cardOffsets.map((o) => Math.round(o.yPt)));
    expect(distinctX.size).toBe(6);
    expect(distinctY.size).toBe(2);
  });

  it("interpolates 5 metrics as 3 columns (row-major: 3 then 2)", () => {
    const cardOffsets = cardOffsetsOf(buildDynamicCardShapes(metrics(5)));
    const distinctX = new Set(cardOffsets.map((o) => Math.round(o.xPt)));
    expect(distinctX.size).toBe(3);
  });

  it("keeps every card within the measured template card region", () => {
    const cardOffsets = cardOffsetsOf(buildDynamicCardShapes(metrics(12)));
    for (const o of cardOffsets) {
      expect(o.xPt).toBeGreaterThanOrEqual(DEFAULT_CARD_REGION.x - 1);
      expect(o.xPt).toBeLessThan(DEFAULT_CARD_REGION.x + DEFAULT_CARD_REGION.w);
      expect(o.yPt).toBeGreaterThanOrEqual(DEFAULT_CARD_REGION.y - 1);
      expect(o.yPt).toBeLessThan(DEFAULT_CARD_REGION.y + DEFAULT_CARD_REGION.h);
    }
  });

  it("renders each metric's uppercased label and its value as visible text", () => {
    const shapes = buildDynamicCardShapes([
      { key: "website_leads", label: "website leads", value: "$4,521", type: "secondary", format: "number" },
    ]);
    const joined = shapes.join("");
    expect(joined).toContain("WEBSITE LEADS");
    expect(joined).toContain("$4,521");
  });

  it("preserves metrics' own array order as left-to-right/top-to-bottom card order", () => {
    // 4 metrics -> 2 columns, so index 0/1 are the first row's left/right
    // cards — a real check of row-major fill order (unlike n=2, where
    // cols=ceil(2/2)=1 puts both cards in a single column instead).
    const cardOffsets = cardOffsetsOf(buildDynamicCardShapes(metrics(4)));
    expect(cardOffsets[0].xPt).toBeLessThan(cardOffsets[1].xPt);
  });

  it("never lets the label font size drop below the 8pt floor, even at the 12-card/6-column minimum width (Fix 3)", () => {
    const longLabelMetrics: CardMetric[] = Array.from({ length: 12 }, (_, i) => ({
      key: `metric_${i + 1}`,
      label: "A REALLY VERY EXTREMELY LONG METRIC LABEL TEXT",
      value: "$1,234,567.89",
      type: "secondary",
      format: "currency",
    }));
    const shapes = buildDynamicCardShapes(longLabelMetrics);
    const labelSizes = [...shapes.join("|SPLIT|").matchAll(/Metric Label"[\s\S]*?sz="(\d+)"/g)].map((m) => Number(m[1]) / 100);
    expect(labelSizes.length).toBeGreaterThan(0);
    for (const sz of labelSizes) expect(sz).toBeGreaterThanOrEqual(8);
  });
});

describe("buildDynamicCardShapes — real template styling (Fix 1)", () => {
  it("reuses the template's exact card background fill, roundRect corner radius, and shadow", () => {
    const shapes = buildDynamicCardShapes(metrics(4));
    const bg = shapes[0];
    expect(bg).toContain('<a:schemeClr val="accent5"/>');
    expect(bg).toContain('fmla="val 12280"');
    expect(bg).toContain("outerShdw");
  });

  it("reuses the template's exact icon badge gradient (accent1-4) and its own drop shadow", () => {
    const shapes = buildDynamicCardShapes(metrics(1), { results: "rId50" });
    const badge = shapes[1];
    expect(badge).toContain('<a:schemeClr val="accent1"/>');
    expect(badge).toContain('<a:schemeClr val="accent2"/>');
    expect(badge).toContain('<a:schemeClr val="accent3"/>');
    expect(badge).toContain('<a:schemeClr val="accent4"/>');
    expect(badge).toContain("gradFill");
    const pic = shapes[2];
    expect(pic).toContain("outerShdw");
    expect(pic).toContain('r:embed="rId50"');
  });

  it("always gives the icon badge an equal width and height (never a stretched oval, even at the narrowest 6-column width)", () => {
    const shapes = buildDynamicCardShapes(metrics(12), { results: "rId1" });
    // Every 5th shape is this card's badge (card, badge, pic, label, value).
    const badges = shapes.filter((s) => s.includes("Metric Icon Badge"));
    for (const badge of badges) {
      const m = badge.match(/<a:ext cx="(\d+)" cy="(\d+)"\/>/);
      expect(m).not.toBeNull();
      expect(m![1]).toBe(m![2]);
    }
  });

  it("uses the template's own Poppins/Poppins Medium fonts for value and label text", () => {
    const shapes = buildDynamicCardShapes(metrics(1));
    const joined = shapes.join("|SPLIT|");
    expect(joined).toContain('typeface="Poppins Medium"');
    expect(joined).toContain('typeface="Poppins"');
  });
});

describe("buildDynamicCardShapes — icon fallback (Fix 1 step 6: closest available icon for secondaries)", () => {
  it("omits the <p:pic> (badge circle still renders) when iconRelIds has no entry for the resolved icon", () => {
    const shapes = buildDynamicCardShapes(metrics(1));
    expect(shapes.some((s) => s.startsWith("<p:pic>"))).toBe(false);
    expect(shapes.some((s) => s.includes("Metric Icon Badge"))).toBe(true);
  });

  it("resolves a secondary metric with no direct icon match to its closest available template icon (via metric-icons.ts's resolveMetricIconId)", () => {
    const shapes = buildDynamicCardShapes(
      [{ key: "roas", label: "PURCHASE ROAS", value: "3.2", type: "secondary", format: "ratio" }],
      { cost: "rId7" },
    );
    // format "ratio" with no key override resolves to the "cost" icon id (see resolveMetricIconId) — confirms the fallback path picks a real relationship id, not nothing.
    expect(shapes.some((s) => s.includes('r:embed="rId7"'))).toBe(true);
  });
});
