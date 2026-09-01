/** Fixed MTD overview slide layout — donut left, metrics table right. */
export const MTD_SLIDE_W = 960;
export const MTD_SLIDE_H = 540;

/** Original donut — unchanged from pre-multi-objective design. */
export const MTD_DONUT = {
  cx: 220,
  cy: 310,
  d: 220,
  x: 110,
  y: 200,
  outerR: 110,
} as const;

export const MTD_METRICS_TABLE = {
  x: 340,
  y: 108,
  w: 580,
  maxH: 352,
} as const;

export const MTD_FOOTER_Y = { ooxml: 468, svg: 488 } as const;

/** Column width fractions for the four-column metrics table. */
export const MTD_TABLE_COL_FRACS = [0.4, 0.22, 0.16, 0.22] as const;

export function mtdTableColumnWidths(tableW: number): number[] {
  return MTD_TABLE_COL_FRACS.map((f) => Math.round(tableW * f));
}
