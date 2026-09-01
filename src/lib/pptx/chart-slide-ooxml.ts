/**
 * Native OOXML builders for the MTD overview chart slide — editable text,
 * KPI cards, and donut ring shapes in PowerPoint and Google Slides.
 */

import type { ShareChartData, ShareDonutSegment } from "../nre/share-report";
import { resolveChartFooterInsight, formatDonutSegmentStats, buildChartKpiLayout } from "../nre/share-chart-projection";
import type { TemplateBackgroundImage } from "./package";
import { CHART_BG_REL_ID, DONUT_HOLE_RATIO } from "./chart-slide-constants";
import { REPORT_HEADER_COLOR, REPORT_HEADER_SIZE_PT } from "./fill-tags";
import { buildMtdChartSlideGeometry, MTD_SLIDE_W } from "./chart-slide-layout";
import {
  backgroundImage,
  buildBlankSlideXml,
  donutRing,
  resetShapeIdCounter,
  roundedCard,
  textBox,
  type DonutRingSegment,
} from "./shapes";

/** Pie wedges use 0° = 3 o'clock; offset so 0% spend starts at 12 o'clock. */
const DONUT_START_DEG = 270;

const DARK = {
  ink: "ffffff",
  inkSubtitle: "e2e8f0",
  accent: "f6ad55",
  kpiBg: "131d30",
  kpiBorder: "1e293b",
  holeFill: "0d1b2e",
};

const LIGHT = {
  ink: "0d1b2e",
  inkSubtitle: "475569",
  accent: "d97706",
  kpiBg: "f8fafc",
  kpiBorder: "cbd5e1",
  holeFill: "ffffff",
};

function buildColoredPieSegments(donutSegments: ShareDonutSegment[]): DonutRingSegment[] {
  const segments: DonutRingSegment[] = [];
  let angle = DONUT_START_DEG;

  for (const seg of donutSegments) {
    const sweep = (seg.percentage / 100) * 360;
    if (sweep <= 0) continue;

    if (sweep >= 359.9) {
      segments.push({
        startDeg: DONUT_START_DEG,
        endDeg: DONUT_START_DEG + 180,
        fillHex: seg.color,
      });
      segments.push({
        startDeg: DONUT_START_DEG + 180,
        endDeg: DONUT_START_DEG + 360,
        fillHex: seg.color,
      });
      return segments;
    }

    segments.push({ startDeg: angle, endDeg: angle + sweep, fillHex: seg.color });
    angle += sweep;
  }

  return segments;
}

/** All native shapes for one MTD overview slide (background + content). */
export function buildMtdOverviewOoxmlShapes(
  chart: ShareChartData,
  background: TemplateBackgroundImage,
  isLightTemplate = false,
): string[] {
  resetShapeIdCounter();
  const c = isLightTemplate ? LIGHT : DARK;
  const W = MTD_SLIDE_W;
  const shapes: string[] = [backgroundImage({ relId: CHART_BG_REL_ID, ...background })];

  shapes.push(
    textBox({
      x: 40,
      y: 28,
      w: W - 80,
      h: 32,
      text: chart.title,
      sizePt: REPORT_HEADER_SIZE_PT,
      bold: true,
      colorHex: REPORT_HEADER_COLOR,
      align: "ctr",
    }),
    textBox({
      x: 40,
      y: 58,
      w: W - 80,
      h: 24,
      text: chart.subtitle,
      sizePt: 16,
      colorHex: c.inkSubtitle,
      align: "ctr",
    }),
  );

  const layout = buildChartKpiLayout(chart.snapshot);
  const geo = buildMtdChartSlideGeometry(layout);

  if (layout.mode === "single") {
    const { y: kpiY, h: kpiH, w: kpiW, gap: kpiGap } = geo.accountKpi;
    const kpiStartX = (W - (4 * kpiW + 3 * kpiGap)) / 2;
    layout.accountTiles.forEach((tile, i) => {
      const x = kpiStartX + i * (kpiW + kpiGap);
      shapes.push(
        roundedCard({ x, y: kpiY, w: kpiW, h: kpiH, fillHex: c.kpiBg, strokeHex: c.kpiBorder, radiusPt: 8 }),
        textBox({ x, y: kpiY + 14, w: kpiW, h: 32, text: tile.value, sizePt: 22, bold: true, colorHex: c.ink, align: "ctr" }),
        textBox({ x, y: kpiY + 48, w: kpiW, h: 20, text: tile.label.toUpperCase(), sizePt: 10, bold: true, colorHex: c.accent, align: "ctr" }),
      );
    });
  } else {
    const { y: accountY, h: accountH, w: accountW, gap: accountGap } = geo.accountKpi;
    const accountStartX = (W - (2 * accountW + accountGap)) / 2;
    layout.accountTiles.forEach((tile, i) => {
      const x = accountStartX + i * (accountW + accountGap);
      shapes.push(
        roundedCard({ x, y: accountY, w: accountW, h: accountH, fillHex: c.kpiBg, strokeHex: c.kpiBorder, radiusPt: 8 }),
        textBox({ x, y: accountY + 10, w: accountW, h: 28, text: tile.value, sizePt: 22, bold: true, colorHex: c.ink, align: "ctr" }),
        textBox({ x, y: accountY + 40, w: accountW, h: 18, text: tile.label.toUpperCase(), sizePt: 10, bold: true, colorHex: c.accent, align: "ctr" }),
      );
    });

    const objBand = geo.objectiveKpi!;
    const objCount = layout.objectiveBlocks.length;
    const objStartX = (W - (objCount * geo.objectiveTileW + (objCount - 1) * objBand.gap)) / 2;
    layout.objectiveBlocks.forEach((obj, i) => {
      const x = objStartX + i * (geo.objectiveTileW + objBand.gap);
      const objY = objBand.y;
      const objH = objBand.h;
      const objW = geo.objectiveTileW;
      shapes.push(
        roundedCard({ x, y: objY, w: objW, h: objH, fillHex: c.kpiBg, strokeHex: c.kpiBorder, radiusPt: 8 }),
        textBox({ x, y: objY + 4, w: objW, h: 12, text: obj.label.toUpperCase(), sizePt: 9, bold: true, colorHex: c.accent, align: "ctr" }),
        textBox({ x, y: objY + 18, w: objW, h: 22, text: obj.resultsValue, sizePt: 18, bold: true, colorHex: c.ink, align: "ctr" }),
        textBox({ x, y: objY + 38, w: objW, h: 14, text: obj.cprValue, sizePt: 12, bold: true, colorHex: c.ink, align: "ctr" }),
        textBox({ x, y: objY + 50, w: objW, h: 10, text: obj.cprLabel.toUpperCase(), sizePt: 8, bold: true, colorHex: c.inkSubtitle, align: "ctr" }),
        textBox({ x, y: objY + 60, w: objW, h: 12, text: `${obj.spendFormatted} spent`, sizePt: 9, colorHex: c.inkSubtitle, align: "ctr" }),
      );
    });
  }

  const { x: donutX, y: donutY, d: donutD, cy: donutCy } = geo.donut;

  if (chart.donutSegments.length > 0) {
    shapes.push(
      ...donutRing({
        x: donutX,
        y: donutY,
        d: donutD,
        segments: buildColoredPieSegments(chart.donutSegments),
        holeRatio: DONUT_HOLE_RATIO,
        holeFillHex: c.holeFill,
      }),
    );
  }

  shapes.push(
    textBox({
      x: donutX,
      y: donutCy - 22,
      w: donutD,
      h: 28,
      text: chart.totalSpendLabel,
      sizePt: 22,
      bold: true,
      colorHex: c.ink,
      align: "ctr",
      anchor: "ctr",
    }),
    textBox({
      x: donutX,
      y: donutCy + 4,
      w: donutD,
      h: 18,
      text: "TOTAL SPEND",
      sizePt: 11,
      bold: true,
      colorHex: c.inkSubtitle,
      align: "ctr",
      anchor: "ctr",
    }),
  );

  let legendY = geo.legend.y;
  const legendX = geo.legend.x;
  const legendStatsColor = isLightTemplate ? "64748b" : "94a3b8";
  for (const seg of chart.donutSegments) {
    shapes.push(
      roundedCard({
        x: legendX,
        y: legendY,
        w: 14,
        h: 14,
        fillHex: seg.color,
        strokeHex: seg.color,
        radiusPt: 2,
      }),
      textBox({
        x: legendX + 22,
        y: legendY - 2,
        w: W - legendX - 40,
        h: 22,
        text: seg.name,
        sizePt: 15,
        bold: true,
        colorHex: c.ink,
        align: "l",
      }),
      textBox({
        x: legendX + 22,
        y: legendY + 16,
        w: W - legendX - 40,
        h: 20,
        text: formatDonutSegmentStats(seg.percentage, seg.spendLabel),
        sizePt: 14,
        colorHex: legendStatsColor,
        align: "l",
      }),
    );
    legendY += geo.legend.rowH;
  }

  shapes.push(
    textBox({
      x: 40,
      y: geo.footerY.ooxml,
      w: W - 80,
      h: 28,
      text: resolveChartFooterInsight(chart),
      sizePt: 14,
      colorHex: c.inkSubtitle,
      align: "ctr",
    }),
  );

  return shapes;
}

export function buildMtdOverviewSlideXml(
  chart: ShareChartData,
  background: TemplateBackgroundImage,
  isLightTemplate = false,
): string {
  return buildBlankSlideXml(buildMtdOverviewOoxmlShapes(chart, background, isLightTemplate));
}
