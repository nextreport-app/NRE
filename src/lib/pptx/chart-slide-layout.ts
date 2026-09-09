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

const IDEAL_RESULT_BAR_ROW_H =
  MTD_VISUAL.barNameH +
  4 +
  MTD_VISUAL.barMetricsH +
  6 +
  MTD_VISUAL.barH +
  MTD_VISUAL.barRowGap;

export interface ResultBarLayout {
  rowH: number;
  startY: number;
  nameH: number;
  metricsH: number;
  barH: number;
  nameMetricsGap: number;
  metricsBarGap: number;
  nameSizePt: number;
  metricsSizePt: number;
}

/** Scales right-panel result bars to fit inside the panel when campaign count is high. */
export function resultBarLayout(barCount: number): ResultBarLayout {
  const header = MTD_VISUAL.panelHeadingH + 8;
  const available = MTD_VISUAL.panelH - header;
  const minRowH = 52;

  const rowH =
    barCount > 0
      ? Math.max(minRowH, Math.min(IDEAL_RESULT_BAR_ROW_H, Math.floor(available / barCount)))
      : IDEAL_RESULT_BAR_ROW_H;

  const scale = Math.min(1, rowH / IDEAL_RESULT_BAR_ROW_H);
  const nameH = Math.max(12, Math.round(MTD_VISUAL.barNameH * scale));
  const metricsH = Math.max(13, Math.round(MTD_VISUAL.barMetricsH * scale));
  const barH = Math.max(12, Math.round(MTD_VISUAL.barH * scale));
  const nameMetricsGap = Math.max(2, Math.round(4 * scale));
  const metricsBarGap = Math.max(3, Math.round(6 * scale));
  const nameSizePt = scale <= 0.72 ? 11 : scale <= 0.82 ? 12 : scale <= 0.92 ? 13 : 15;
  const metricsSizePt = scale <= 0.72 ? 12 : scale <= 0.82 ? 13 : scale <= 0.92 ? 14 : 16;

  const blockH = barCount * rowH;
  const startY = MTD_VISUAL.panelY + header + Math.max(0, (available - blockH) / 2);

  return { rowH, startY, nameH, metricsH, barH, nameMetricsGap, metricsBarGap, nameSizePt, metricsSizePt };
}

export function resultBarGeometry(barCount: number): { rowH: number; startY: number } {
  const layout = resultBarLayout(barCount);
  return { rowH: layout.rowH, startY: layout.startY };
}

export interface GroupedDonutLayout {
  donutD: number;
  legendRowH: number;
  legendRowGap: number;
  legendSizePt: number;
  blockTopY: number;
}

/** Scales grouped donut + legend on the left when many campaigns share the panel. */
export function groupedDonutLayout(segmentCount: number, panelTopY: number): GroupedDonutLayout {
  const header = MTD_VISUAL.panelHeadingH + 8;
  const available = MTD_VISUAL.panelH - header;

  let donutD: number = MTD_VISUAL.groupedDonutD;
  let legendRowH: number = MTD_VISUAL.groupedDonutLegendRowH;
  let legendRowGap: number = MTD_VISUAL.groupedDonutLegendRowGap;
  let legendSizePt: number = MTD_VISUAL.groupedDonutLegendSizePt;

  if (segmentCount >= 6) {
    donutD = 158;
    legendRowH = 16;
    legendRowGap = 4;
    legendSizePt = 11;
  } else if (segmentCount >= 5) {
    donutD = 168;
    legendRowH = 18;
    legendRowGap = 5;
    legendSizePt = 12;
  } else if (segmentCount >= 4) {
    legendRowH = 20;
    legendRowGap = 6;
    legendSizePt = 14;
  }

  const legendH = segmentCount * (legendRowH + legendRowGap) - legendRowGap;
  const blockH = donutD + 16 + legendH;
  const blockTopY = panelTopY + header + Math.max(0, (available - blockH) / 2);

  return { donutD, legendRowH, legendRowGap, legendSizePt, blockTopY };
}

/** Vertically center the grouped donut + legend block inside the left panel. */
export function groupedDonutBlockTopY(segmentCount: number, panelTopY: number): number {
  return groupedDonutLayout(segmentCount, panelTopY).blockTopY;
}
