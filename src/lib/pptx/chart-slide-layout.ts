/** Fixed MTD overview slide layout — KPI cards top, donut left, spend bars right. */
export const MTD_SLIDE_W = 960;
export const MTD_SLIDE_H = 540;

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
