import { describe, expect, it } from "vitest";
import { groupedDonutLayout, MTD_VISUAL, MTD_SLIDE_H, resultBarLayout } from "../chart-slide-layout";

describe("MTD visual chart slide layout", () => {
  it("keeps summary strip inside the slide canvas", () => {
    expect(MTD_VISUAL.summaryY + MTD_VISUAL.summaryH).toBeLessThanOrEqual(MTD_SLIDE_H);
  });

  it("shrinks result bar rows when five campaigns would overflow the panel", () => {
    const layout = resultBarLayout(5);
    const header = MTD_VISUAL.panelHeadingH + 8;
    const available = MTD_VISUAL.panelH - header;
    expect(layout.rowH * 5).toBeLessThanOrEqual(available);
    expect(layout.nameSizePt).toBeLessThan(15);
  });

  it("keeps grouped donut block inside the left panel for five segments", () => {
    const layout = groupedDonutLayout(5, MTD_VISUAL.panelY);
    const header = MTD_VISUAL.panelHeadingH + 8;
    const available = MTD_VISUAL.panelH - header;
    const blockH =
      layout.donutD +
      16 +
      (5 * (layout.legendRowH + layout.legendRowGap) - layout.legendRowGap);
    expect(layout.blockTopY + blockH - MTD_VISUAL.panelY - header).toBeLessThanOrEqual(available);
    expect(layout.donutD).toBeLessThan(MTD_VISUAL.groupedDonutD);
  });
});
