import { describe, it, expect } from "vitest";
import { buildDynamicCardShapes, DEFAULT_CARD_REGION, type CardMetric } from "../dynamic-cards";

const EMU_PER_PT = 12700;

function offsetsOf(shapesXml: string[]): { xPt: number; yPt: number }[] {
  const offsets: { xPt: number; yPt: number }[] = [];
  for (const shape of shapesXml) {
    const m = shape.match(/<a:off x="(\d+)" y="(\d+)"\/>/);
    if (m) offsets.push({ xPt: Number(m[1]) / EMU_PER_PT, yPt: Number(m[2]) / EMU_PER_PT });
  }
  return offsets;
}

function metrics(n: number): CardMetric[] {
  return Array.from({ length: n }, (_, i) => ({ label: `Metric ${i + 1}`, value: `${(i + 1) * 100}` }));
}

describe("buildDynamicCardShapes — grid layout", () => {
  it("returns no shapes for an empty metric list", () => {
    expect(buildDynamicCardShapes([])).toEqual([]);
  });

  it("emits exactly 3 shapes per metric (card background + label + value)", () => {
    for (const n of [4, 5, 6, 7, 8]) {
      expect(buildDynamicCardShapes(metrics(n)).length).toBe(n * 3);
    }
  });

  it("lays out 4 metrics as 2 columns x 2 rows", () => {
    // Every 3rd shape is a card background (the first of each metric's 3) —
    // its <a:off> gives the card's own top-left corner.
    const shapes = buildDynamicCardShapes(metrics(4));
    const cardOffsets = offsetsOf(shapes.filter((_, i) => i % 3 === 0));
    const distinctX = new Set(cardOffsets.map((o) => Math.round(o.xPt)));
    const distinctY = new Set(cardOffsets.map((o) => Math.round(o.yPt)));
    expect(distinctX.size).toBe(2);
    expect(distinctY.size).toBe(2);
  });

  it("lays out 6 metrics as 3 columns x 2 rows", () => {
    const shapes = buildDynamicCardShapes(metrics(6));
    const cardOffsets = offsetsOf(shapes.filter((_, i) => i % 3 === 0));
    const distinctX = new Set(cardOffsets.map((o) => Math.round(o.xPt)));
    const distinctY = new Set(cardOffsets.map((o) => Math.round(o.yPt)));
    expect(distinctX.size).toBe(3);
    expect(distinctY.size).toBe(2);
  });

  it("lays out 8 metrics as 4 columns x 2 rows", () => {
    const shapes = buildDynamicCardShapes(metrics(8));
    const cardOffsets = offsetsOf(shapes.filter((_, i) => i % 3 === 0));
    const distinctX = new Set(cardOffsets.map((o) => Math.round(o.xPt)));
    const distinctY = new Set(cardOffsets.map((o) => Math.round(o.yPt)));
    expect(distinctX.size).toBe(4);
    expect(distinctY.size).toBe(2);
  });

  it("interpolates 5 metrics as 3 columns (row-major: 3 then 2)", () => {
    const shapes = buildDynamicCardShapes(metrics(5));
    const cardOffsets = offsetsOf(shapes.filter((_, i) => i % 3 === 0));
    const distinctX = new Set(cardOffsets.map((o) => Math.round(o.xPt)));
    expect(distinctX.size).toBe(3);
  });

  it("keeps every card within the measured template card region", () => {
    const shapes = buildDynamicCardShapes(metrics(8));
    const cardOffsets = offsetsOf(shapes.filter((_, i) => i % 3 === 0));
    for (const o of cardOffsets) {
      expect(o.xPt).toBeGreaterThanOrEqual(DEFAULT_CARD_REGION.x - 1);
      expect(o.xPt).toBeLessThan(DEFAULT_CARD_REGION.x + DEFAULT_CARD_REGION.w);
      expect(o.yPt).toBeGreaterThanOrEqual(DEFAULT_CARD_REGION.y - 1);
      expect(o.yPt).toBeLessThan(DEFAULT_CARD_REGION.y + DEFAULT_CARD_REGION.h);
    }
  });

  it("renders each metric's uppercased label and its value as visible text", () => {
    const shapes = buildDynamicCardShapes([{ label: "website leads", value: "$4,521" }]);
    const joined = shapes.join("");
    expect(joined).toContain("WEBSITE LEADS");
    expect(joined).toContain("$4,521");
  });

  it("preserves metrics' own array order as left-to-right/top-to-bottom card order", () => {
    // 4 metrics -> 2 columns, so index 0/1 are the first row's left/right
    // cards — a real check of row-major fill order (unlike n=2, where
    // cols=ceil(2/2)=1 puts both cards in a single column instead).
    const shapes = buildDynamicCardShapes([
      { label: "First", value: "1" },
      { label: "Second", value: "2" },
      { label: "Third", value: "3" },
      { label: "Fourth", value: "4" },
    ]);
    const cardOffsets = offsetsOf(shapes.filter((_, i) => i % 3 === 0));
    expect(cardOffsets[0].xPt).toBeLessThan(cardOffsets[1].xPt);
  });
});
