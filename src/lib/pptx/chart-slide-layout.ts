import type { ChartKpiLayout } from "../nre/chart-kpi-layout";

export const MTD_SLIDE_W = 960;
export const MTD_SLIDE_H = 540;

export interface MtdChartKpiBand {
  y: number;
  h: number;
  w: number;
  gap: number;
}

export interface MtdChartSlideGeometry {
  mode: "single" | "multi";
  accountKpi: MtdChartKpiBand;
  objectiveKpi: MtdChartKpiBand | null;
  /** Objective tile width — computed from count when multi. */
  objectiveTileW: number;
  donut: { x: number; y: number; d: number; cx: number; cy: number; outerR: number };
  legend: { x: number; y: number; rowH: number };
  footerY: { ooxml: number; svg: number };
}

/** Fixed vertical geometry for the MTD overview slide — shared by SVG and OOXML. */
export function buildMtdChartSlideGeometry(layout: ChartKpiLayout): MtdChartSlideGeometry {
  const legendX = 380;
  const footerY = { ooxml: 468, svg: 488 };

  if (layout.mode === "single") {
    const kpiY = 92;
    const kpiH = 88;
    const donutD = 220;
    const donutY = 200;
    return {
      mode: "single",
      accountKpi: { y: kpiY, h: kpiH, w: 200, gap: 16 },
      objectiveKpi: null,
      objectiveTileW: 0,
      donut: {
        x: 110,
        y: donutY,
        d: donutD,
        cx: 220,
        cy: 310,
        outerR: donutD / 2,
      },
      legend: { x: legendX, y: 220, rowH: 44 },
      footerY,
    };
  }

  const objCount = Math.max(1, layout.objectiveBlocks.length);
  const accountY = 86;
  const accountH = 72;
  const objGap = 12;
  const objH = 76;
  const objY = accountY + accountH + 10;
  const objW = Math.min(220, (MTD_SLIDE_W - objGap * (objCount - 1) - 80) / objCount);
  const kpiBottom = objY + objH;
  const donutD = 140;
  const donutY = kpiBottom + 10;
  const donutX = 110;
  const outerR = donutD / 2;

  return {
    mode: "multi",
    accountKpi: { y: accountY, h: accountH, w: 320, gap: 24 },
    objectiveKpi: { y: objY, h: objH, w: objW, gap: objGap },
    objectiveTileW: objW,
    donut: {
      x: donutX,
      y: donutY,
      d: donutD,
      cx: donutX + outerR,
      cy: donutY + outerR,
      outerR,
    },
    legend: { x: legendX, y: donutY, rowH: 36 },
    footerY,
  };
}
