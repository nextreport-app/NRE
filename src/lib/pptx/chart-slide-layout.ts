/** MTD Visual Chart slide — two-panel layout (960×540 pt). */
export const MTD_SLIDE_W = 960;
export const MTD_SLIDE_H = 540;

const MTD_BLOCK = {
  titleH: 50,
  gapAfterTitle: 8,
  panelH: 384,
  gapBeforeSummary: 12,
  summaryH: 36,
} as const;

function mtdContentBlockTop(): number {
  const blockH =
    MTD_BLOCK.titleH +
    MTD_BLOCK.gapAfterTitle +
    MTD_BLOCK.panelH +
    MTD_BLOCK.gapBeforeSummary +
    MTD_BLOCK.summaryH;
  return Math.round((MTD_SLIDE_H - blockH) / 2);
}

const MTD_BLOCK_TOP = mtdContentBlockTop();

export const MTD_VISUAL = {
  marginX: 52,
  titleY: MTD_BLOCK_TOP,
  titleH: MTD_BLOCK.titleH,
  panelY: MTD_BLOCK_TOP + MTD_BLOCK.titleH + MTD_BLOCK.gapAfterTitle,
  panelH: MTD_BLOCK.panelH,
  summaryY: MTD_BLOCK_TOP + MTD_BLOCK.titleH + MTD_BLOCK.gapAfterTitle + MTD_BLOCK.panelH + MTD_BLOCK.gapBeforeSummary,
  summaryH: MTD_BLOCK.summaryH,
  leftX: 52,
  leftW: 348,
  sepX: 412,
  rightX: 428,
  rightW: 480,
  miniDonutCaptionH: 28,
  groupedDonutD: 188,
  barH: 26,
  barNameH: 18,
  barMetricsH: 20,
  barRowGap: 16,
  groupedDonutLegendRowH: 22,
  groupedDonutLegendRowGap: 8,
  groupedDonutLegendSizePt: 16,
  barTrackMaxW: 448,
  labelColW: 0,
  panelHeadingH: 26,
  panelPad: 14,
} as const;

/** @deprecated Legacy layout constants — kept for tests referencing old geometry. */
export const MTD_DONUT_D = 220;
export const MTD_DONUT_X = 110;
export const MTD_DONUT_OUTER_R = MTD_DONUT_D / 2;
export const MTD_CAMPAIGN_BARS = {
  x: 340,
  w: 580,
  labelColW: 168,
  barColW: 248,
  valueColW: 140,
  gap: 12,
} as const;
export const MTD_KPI = {
  y: 92,
  singleRowH: 88,
  accountRowH: 64,
  objectiveRowH: 76,
  gap: 16,
  singleCardW: 200,
  multiAccountW: 320,
} as const;
export const MTD_FOOTER_Y = { ooxml: 472, svg: 488 } as const;

export function mtdDonutCenterX(): number {
  return MTD_DONUT_X + MTD_DONUT_OUTER_R;
}

export function miniDonutGrid(count: number): { cols: number; rows: number } {
  if (count <= 2) return { cols: count, rows: 1 };
  if (count <= 4) return { cols: 2, rows: 2 };
  return { cols: 2, rows: 3 };
}

/** Larger donuts when fewer campaigns — keeps six-campaign grids readable. */
export function miniDonutDiameter(count: number): number {
  if (count <= 2) return 140;
  if (count <= 4) return 120;
  return 100;
}

export function miniDonutPosition(index: number, count: number): { x: number; y: number; d: number } {
  const d = miniDonutDiameter(count);
  const { cols, rows } = miniDonutGrid(count);
  const col = index % cols;
  const row = Math.floor(index / cols);
  const gapX = 10;
  const gapY = 10;
  const gridW = cols * d + (cols - 1) * gapX;
  const gridH = rows * d + (rows - 1) * gapY + MTD_VISUAL.miniDonutCaptionH;
  const startX = MTD_VISUAL.leftX + (MTD_VISUAL.leftW - gridW) / 2;
  const startY = MTD_VISUAL.panelY + MTD_VISUAL.panelHeadingH + 8 + (MTD_VISUAL.panelH - MTD_VISUAL.panelHeadingH - gridH - 28) / 2;
  return {
    x: startX + col * (d + gapX),
    y: startY + row * (d + gapY + MTD_VISUAL.miniDonutCaptionH),
    d,
  };
}

export function resultBarGeometry(barCount: number): { rowH: number; startY: number } {
  const header = MTD_VISUAL.panelHeadingH + 8;
  const available = MTD_VISUAL.panelH - header;
  const ideal =
    MTD_VISUAL.barNameH +
    4 +
    MTD_VISUAL.barMetricsH +
    6 +
    MTD_VISUAL.barH +
    MTD_VISUAL.barRowGap;
  const rowH = barCount > 0 ? Math.min(92, Math.max(ideal, Math.floor(available / barCount))) : ideal;
  const blockH = barCount * rowH;
  const startY = MTD_VISUAL.panelY + header + Math.max(0, (available - blockH) / 2);
  return { rowH, startY };
}

/** Vertically center the grouped donut + legend block inside the left panel. */
export function groupedDonutBlockTopY(segmentCount: number, panelTopY: number): number {
  const header = MTD_VISUAL.panelHeadingH + 8;
  const legendH =
    segmentCount * (MTD_VISUAL.groupedDonutLegendRowH + MTD_VISUAL.groupedDonutLegendRowGap) -
    MTD_VISUAL.groupedDonutLegendRowGap;
  const blockH = MTD_VISUAL.groupedDonutD + 16 + legendH;
  const available = MTD_VISUAL.panelH - header;
  return panelTopY + header + Math.max(0, (available - blockH) / 2);
}
