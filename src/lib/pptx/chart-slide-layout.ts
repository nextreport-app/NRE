/** MTD Visual Chart slide — two-panel layout (960×540 pt). */
export const MTD_SLIDE_W = 960;
export const MTD_SLIDE_H = 540;

export const MTD_VISUAL = {
  marginX: 40,
  titleY: 28,
  titleH: 40,
  panelY: 88,
  panelH: 368,
  summaryY: 472,
  summaryH: 36,
  leftX: 40,
  leftW: 320,
  sepX: 372,
  rightX: 388,
  rightW: 532,
  miniDonutD: 108,
  miniDonutCaptionH: 18,
  groupedDonutD: 168,
  barH: 20,
  barMetricsH: 28,
  barRowGap: 8,
  barTrackMaxW: 360,
  labelColW: 124,
  panelHeadingH: 22,
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

export function miniDonutPosition(index: number, count: number): { x: number; y: number } {
  const { cols, rows } = miniDonutGrid(count);
  const col = index % cols;
  const row = Math.floor(index / cols);
  const gapX = 12;
  const gapY = 12;
  const gridW = cols * MTD_VISUAL.miniDonutD + (cols - 1) * gapX;
  const gridH = rows * MTD_VISUAL.miniDonutD + (rows - 1) * gapY + MTD_VISUAL.miniDonutCaptionH;
  const startX = MTD_VISUAL.leftX + (MTD_VISUAL.leftW - gridW) / 2;
  const startY = MTD_VISUAL.panelY + MTD_VISUAL.panelHeadingH + 8 + (MTD_VISUAL.panelH - MTD_VISUAL.panelHeadingH - gridH) / 2;
  return {
    x: startX + col * (MTD_VISUAL.miniDonutD + gapX),
    y: startY + row * (MTD_VISUAL.miniDonutD + gapY + MTD_VISUAL.miniDonutCaptionH),
  };
}

export function resultBarGeometry(barCount: number): { rowH: number; startY: number } {
  const header = MTD_VISUAL.panelHeadingH + 8;
  const available = MTD_VISUAL.panelH - header;
  const ideal = MTD_VISUAL.barH + MTD_VISUAL.barMetricsH + MTD_VISUAL.barRowGap;
  const rowH = barCount > 0 ? Math.min(52, Math.max(ideal, Math.floor(available / barCount))) : ideal;
  const blockH = barCount * rowH;
  const startY = MTD_VISUAL.panelY + header + Math.max(0, (available - blockH) / 2);
  return { rowH, startY };
}
