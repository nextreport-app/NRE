/** MTD Visual Chart slide — two-panel layout (960×540 pt). */
export const MTD_SLIDE_W = 960;
export const MTD_SLIDE_H = 540;

export const MTD_VISUAL = {
  marginX: 36,
  titleY: 20,
  titleH: 34,
  panelY: 64,
  panelH: 396,
  summaryY: 468,
  summaryH: 40,
  leftX: 36,
  leftW: 368,
  sepX: 416,
  rightX: 432,
  rightW: 492,
  miniDonutCaptionH: 24,
  groupedDonutD: 204,
  barH: 28,
  barMetricsH: 34,
  barRowGap: 6,
  barTrackMaxW: 332,
  labelColW: 148,
  panelHeadingH: 28,
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
export const MTD_FOOTER_Y = { ooxml: 468, svg: 488 } as const;

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
  if (count <= 2) return 152;
  if (count <= 4) return 132;
  return 112;
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
  const startY = MTD_VISUAL.panelY + MTD_VISUAL.panelHeadingH + 6 + (MTD_VISUAL.panelH - MTD_VISUAL.panelHeadingH - gridH) / 2;
  return {
    x: startX + col * (d + gapX),
    y: startY + row * (d + gapY + MTD_VISUAL.miniDonutCaptionH),
    d,
  };
}

export function resultBarGeometry(barCount: number): { rowH: number; startY: number } {
  const header = MTD_VISUAL.panelHeadingH + 6;
  const available = MTD_VISUAL.panelH - header;
  const ideal = MTD_VISUAL.barH + MTD_VISUAL.barMetricsH + MTD_VISUAL.barRowGap;
  const rowH = barCount > 0 ? Math.min(58, Math.max(ideal, Math.floor(available / barCount))) : ideal;
  const blockH = barCount * rowH;
  const startY = MTD_VISUAL.panelY + header + Math.max(0, (available - blockH) / 2);
  return { rowH, startY };
}
