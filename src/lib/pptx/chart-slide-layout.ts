/** MTD Visual Chart slide — two-panel layout (960×540 pt). */
export const MTD_SLIDE_W = 960;
export const MTD_SLIDE_H = 540;

export const MTD_VISUAL = {
  marginX: 52,
  titleY: 18,
  titleH: 50,
  panelY: 76,
  panelH: 384,
  summaryY: 472,
  summaryH: 36,
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
  barRowGap: 8,
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
    MTD_VISUAL.barNameH + 4 + MTD_VISUAL.barMetricsH + 4 + MTD_VISUAL.barH + MTD_VISUAL.barRowGap;
  const rowH = barCount > 0 ? Math.min(64, Math.max(ideal, Math.floor(available / barCount))) : ideal;
  const blockH = barCount * rowH;
  const startY = MTD_VISUAL.panelY + header + Math.max(0, (available - blockH) / 2);
  return { rowH, startY };
}
