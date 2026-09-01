/**
 * Native OOXML builders for the MTD overview chart slide — KPI cards, donut,
 * and campaign spend bars for PowerPoint and Google Slides.
 */

import type { ShareChartData, ShareDonutSegment } from "../nre/share-report";
import {
  buildChartCampaignBars,
  buildChartKpiCardRows,
  computeMtdVisualBandMetrics,
} from "../nre/chart-visual-layout";
import { resolveChartFooterInsight, formatDonutSegmentStats } from "../nre/share-chart-projection";
import type { TemplateBackgroundImage } from "./package";
import { CHART_BG_REL_ID, DONUT_HOLE_RATIO } from "./chart-slide-constants";
import { REPORT_HEADER_COLOR, REPORT_HEADER_SIZE_PT } from "./fill-tags";
import {
  campaignBarColumns,
  campaignBarFillWidth,
  CAMPAIGN_BAR_COLORS_DARK,
  CAMPAIGN_BAR_COLORS_LIGHT,
  truncateCampaignBarName,
} from "./chart-campaign-bars-render";
import {
  MTD_CAMPAIGN_BARS,
  MTD_DONUT_D,
  MTD_DONUT_X,
  MTD_FOOTER_Y,
  MTD_KPI,
  MTD_SLIDE_W,
} from "./chart-slide-layout";
import {
  backgroundImage,
  buildBlankSlideXml,
  donutRing,
  resetShapeIdCounter,
  rectangle,
  roundedCard,
  textBox,
  type DonutRingSegment,
} from "./shapes";

const DONUT_START_DEG = 270;

function buildColoredPieSegments(donutSegments: ShareDonutSegment[]): DonutRingSegment[] {
  const segments: DonutRingSegment[] = [];
  let angle = DONUT_START_DEG;

  for (const seg of donutSegments) {
    const sweep = (seg.percentage / 100) * 360;
    if (sweep <= 0) continue;

    if (sweep >= 359.9) {
      segments.push({ startDeg: DONUT_START_DEG, endDeg: DONUT_START_DEG + 180, fillHex: seg.color });
      segments.push({ startDeg: DONUT_START_DEG + 180, endDeg: DONUT_START_DEG + 360, fillHex: seg.color });
      return segments;
    }

    segments.push({ startDeg: angle, endDeg: angle + sweep, fillHex: seg.color });
    angle += sweep;
  }

  return segments;
}

function appendKpiCardsOoxml(shapes: string[], chart: ShareChartData, isLight: boolean): void {
  const cardRows = buildChartKpiCardRows(chart.snapshot);
  const W = MTD_SLIDE_W;
  const fill = isLight ? "f8fafc" : "131d30";
  const stroke = isLight ? "cbd5e1" : "1e293b";
  const ink = isLight ? "0d1b2e" : "ffffff";
  const accent = isLight ? "d97706" : "f6ad55";
  const muted = isLight ? "64748b" : "94a3b8";

  if (cardRows.mode === "single") {
    const row = cardRows.rows[0] ?? [];
    const { y: kpiY, singleRowH: kpiH, singleCardW: kpiW, gap: kpiGap } = MTD_KPI;
    const kpiStartX = (W - (4 * kpiW + 3 * kpiGap)) / 2;
    row.forEach((tile, i) => {
      const x = kpiStartX + i * (kpiW + kpiGap);
      shapes.push(
        roundedCard({ x, y: kpiY, w: kpiW, h: kpiH, fillHex: fill, strokeHex: stroke, radiusPt: 8 }),
        textBox({ x, y: kpiY + 14, w: kpiW, h: 32, text: tile.value, sizePt: 22, bold: true, colorHex: ink, align: "ctr" }),
        textBox({ x, y: kpiY + 48, w: kpiW, h: 20, text: tile.label.toUpperCase(), sizePt: 10, bold: true, colorHex: accent, align: "ctr" }),
      );
    });
    return;
  }

  const accountRow = cardRows.rows[0] ?? [];
  const objectiveRow = cardRows.rows[1] ?? [];
  const accountY = MTD_KPI.y;
  const accountH = MTD_KPI.accountRowH;
  const accountW = MTD_KPI.multiAccountW;
  const accountGap = 24;
  const accountStartX = (W - (accountRow.length * accountW + (accountRow.length - 1) * accountGap)) / 2;
  accountRow.forEach((tile, i) => {
    const x = accountStartX + i * (accountW + accountGap);
    shapes.push(
      roundedCard({ x, y: accountY, w: accountW, h: accountH, fillHex: fill, strokeHex: stroke, radiusPt: 8 }),
      textBox({ x, y: accountY + 10, w: accountW, h: 28, text: tile.value, sizePt: 22, bold: true, colorHex: ink, align: "ctr" }),
      textBox({ x, y: accountY + 40, w: accountW, h: 18, text: tile.label.toUpperCase(), sizePt: 10, bold: true, colorHex: accent, align: "ctr" }),
    );
  });

  const objY = accountY + accountH + 10;
  const objH = MTD_KPI.objectiveRowH;
  const objCount = objectiveRow.length;
  const objGap = 12;
  const objW = Math.min(220, (W - objGap * (objCount - 1) - 80) / Math.max(1, objCount));
  const objStartX = (W - (objCount * objW + (objCount - 1) * objGap)) / 2;
  objectiveRow.forEach((card, i) => {
    const x = objStartX + i * (objW + objGap);
    shapes.push(
      roundedCard({ x, y: objY, w: objW, h: objH, fillHex: fill, strokeHex: stroke, radiusPt: 8 }),
      textBox({ x, y: objY + 4, w: objW, h: 12, text: card.label.toUpperCase(), sizePt: 10, bold: true, colorHex: accent, align: "ctr" }),
      textBox({ x, y: objY + 20, w: objW, h: 28, text: card.value, sizePt: 22, bold: true, colorHex: ink, align: "ctr" }),
    );
    if (card.detail) {
      shapes.push(
        textBox({ x, y: objY + 48, w: objW, h: 16, text: card.detail, sizePt: 10, colorHex: muted, align: "ctr" }),
      );
    }
  });
}

function appendCampaignBarsOoxml(
  shapes: string[],
  chart: ShareChartData,
  barsY: number,
  barRowH: number,
  headerH: number,
  isLight: boolean,
): void {
  const palette = isLight ? CAMPAIGN_BAR_COLORS_LIGHT : CAMPAIGN_BAR_COLORS_DARK;
  const bars = buildChartCampaignBars(chart.donutSegments);
  const cols = campaignBarColumns();
  const { x: areaX } = MTD_CAMPAIGN_BARS as { x: number };

  shapes.push(
    textBox({
      x: areaX,
      y: barsY,
      w: 300,
      h: headerH,
      text: "CAMPAIGN SPEND MIX",
      sizePt: 11,
      bold: true,
      colorHex: palette.accent,
      align: "l",
    }),
  );

  let rowY = barsY + headerH;
  const barH = 14;
  for (const bar of bars) {
    const fillW = campaignBarFillWidth(bar.percentage, cols.trackW);
    const barY = rowY + Math.floor((barRowH - barH) / 2);
    shapes.push(
      textBox({
        x: cols.labelX,
        y: rowY + 2,
        w: cols.labelColW,
        h: barRowH - 4,
        text: truncateCampaignBarName(bar.name),
        sizePt: 13,
        bold: true,
        colorHex: palette.ink,
        align: "l",
        anchor: "ctr",
        clipOverflow: true,
      }),
      rectangle({ x: cols.barX, y: barY, w: cols.trackW, h: barH, fillHex: palette.track }),
    );
    if (fillW > 0) {
      shapes.push(rectangle({ x: cols.barX, y: barY, w: fillW, h: barH, fillHex: bar.color }));
    }
    const pctLabel = formatDonutSegmentStats(bar.percentage, bar.spendLabel).split(" · ")[0] ?? "";
    shapes.push(
      textBox({
        x: cols.valueX,
        y: rowY + 2,
        w: cols.valueColW,
        h: 16,
        text: bar.spendLabel,
        sizePt: 13,
        bold: true,
        colorHex: palette.ink,
        align: "r",
      }),
      textBox({
        x: cols.valueX,
        y: rowY + 18,
        w: cols.valueColW,
        h: 14,
        text: pctLabel,
        sizePt: 11,
        colorHex: palette.inkMuted,
        align: "r",
      }),
    );
    rowY += barRowH;
  }
}

export function buildMtdOverviewOoxmlShapes(
  chart: ShareChartData,
  background: TemplateBackgroundImage,
  isLightTemplate = false,
): string[] {
  resetShapeIdCounter();
  const c = isLightTemplate ? CAMPAIGN_BAR_COLORS_LIGHT : CAMPAIGN_BAR_COLORS_DARK;
  const subtitleColor = isLightTemplate ? c.inkMuted : "e2e8f0";
  const W = MTD_SLIDE_W;
  const cardRows = buildChartKpiCardRows(chart.snapshot);
  const bars = buildChartCampaignBars(chart.donutSegments);
  const band = computeMtdVisualBandMetrics(cardRows, bars.length);
  const donutX = MTD_DONUT_X;
  const donutY = band.donutY;
  const donutCy = band.donutCy;
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
      colorHex: subtitleColor,
      align: "ctr",
    }),
  );

  appendKpiCardsOoxml(shapes, chart, isLightTemplate);

  if (chart.donutSegments.length > 0) {
    shapes.push(
      ...donutRing({
        x: donutX,
        y: donutY,
        d: MTD_DONUT_D,
        segments: buildColoredPieSegments(chart.donutSegments),
        holeRatio: DONUT_HOLE_RATIO,
        holeFillHex: isLightTemplate ? "ffffff" : "0d1b2e",
      }),
    );
  }

  shapes.push(
    textBox({
      x: donutX,
      y: donutCy - 22,
      w: MTD_DONUT_D,
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
      w: MTD_DONUT_D,
      h: 18,
      text: "TOTAL SPEND",
      sizePt: 11,
      bold: true,
      colorHex: c.inkMuted,
      align: "ctr",
      anchor: "ctr",
    }),
  );

  appendCampaignBarsOoxml(shapes, chart, band.barsY, band.barRowH, band.barsHeaderH, isLightTemplate);

  shapes.push(
    textBox({
      x: 40,
      y: MTD_FOOTER_Y.ooxml,
      w: W - 80,
      h: 28,
      text: resolveChartFooterInsight(chart),
      sizePt: 14,
      colorHex: subtitleColor,
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
