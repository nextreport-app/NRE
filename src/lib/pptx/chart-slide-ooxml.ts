/**
 * Native OOXML builders for the MTD Visual Chart slide — two-panel layout.
 */

import type { ShareChartData } from "../nre/share-report";
import type { VisualChartSlideModel } from "../nre/visual-chart-slide";
import type { TemplateBackgroundImage } from "./package";
import { CHART_BG_REL_ID, DONUT_HOLE_RATIO } from "./chart-slide-constants";
import {
  resultBarColumns,
  resultBarFillWidth,
  truncateCampaignBarName,
  VISUAL_CHART_COLORS_DARK,
  VISUAL_CHART_COLORS_LIGHT,
} from "./chart-campaign-bars-render";
import {
  MTD_SLIDE_W,
  MTD_VISUAL,
  miniDonutPosition,
  resultBarGeometry,
} from "./chart-slide-layout";
import { ptToEmu } from "./ooxml";
import {
  backgroundImage,
  buildBlankSlideXml,
  donutRing,
  nextShapeId,
  rectangle,
  resetShapeIdCounter,
  roundedCard,
  textBox,
  type DonutRingSegment,
} from "./shapes";

const DONUT_START_DEG = 270;
const MINI_DONUT_HOLE = (MTD_VISUAL.miniDonutD / 2 - 12) / (MTD_VISUAL.miniDonutD / 2);

function palette(isLight: boolean) {
  return isLight ? VISUAL_CHART_COLORS_LIGHT : VISUAL_CHART_COLORS_DARK;
}

function buildColoredPieSegments(segments: { percentage: number; color: string }[]): DonutRingSegment[] {
  const out: DonutRingSegment[] = [];
  let angle = DONUT_START_DEG;
  for (const seg of segments) {
    const sweep = (seg.percentage / 100) * 360;
    if (sweep <= 0) continue;
    if (sweep >= 359.9) {
      out.push({ startDeg: DONUT_START_DEG, endDeg: DONUT_START_DEG + 180, fillHex: seg.color });
      out.push({ startDeg: DONUT_START_DEG + 180, endDeg: DONUT_START_DEG + 360, fillHex: seg.color });
      return out;
    }
    out.push({ startDeg: angle, endDeg: angle + sweep, fillHex: seg.color });
    angle += sweep;
  }
  return out;
}

function roundedBar(opts: { x: number; y: number; w: number; h: number; fillHex: string }): string {
  const id = nextShapeId();
  const wEmu = ptToEmu(opts.w);
  const hEmu = ptToEmu(opts.h);
  const adj = Math.round((ptToEmu(4) / Math.min(wEmu, hEmu)) * 100000);
  return (
    `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="ResultBar ${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>` +
    `<p:spPr><a:xfrm><a:off x="${ptToEmu(opts.x)}" y="${ptToEmu(opts.y)}"/><a:ext cx="${wEmu}" cy="${hEmu}"/></a:xfrm>` +
    `<a:prstGeom prst="roundRect"><a:avLst><a:gd fmla="val ${adj}" name="adj"/></a:avLst></a:prstGeom>` +
    `<a:solidFill><a:srgbClr val="${opts.fillHex}"/></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr>` +
    `<p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody></p:sp>`
  );
}

function appendMiniDonut(
  shapes: string[],
  x: number,
  y: number,
  d: number,
  color: string,
  spendLabel: string,
  name: string,
  pctLabel: string,
  holeFill: string,
  ink: string,
  muted: string,
): void {
  shapes.push(
    ...donutRing({
      x,
      y,
      d,
      segments: buildColoredPieSegments([{ percentage: 100, color }]),
      holeRatio: MINI_DONUT_HOLE,
      holeFillHex: holeFill,
    }),
  );
  shapes.push(
    textBox({ x, y: y + d / 2 - 8, w: d, h: 16, text: spendLabel, sizePt: 10, bold: true, colorHex: ink, align: "ctr", anchor: "ctr" }),
    textBox({ x, y: y + d + 4, w: d, h: 14, text: name, sizePt: 9, colorHex: ink, align: "ctr", clipOverflow: true }),
    textBox({ x, y: y + d + 18, w: d, h: 12, text: pctLabel, sizePt: 9, colorHex: muted, align: "ctr" }),
  );
}

function appendGroupedDonut(
  shapes: string[],
  model: VisualChartSlideModel,
  leftX: number,
  topY: number,
  holeFill: string,
  ink: string,
  muted: string,
): void {
  const d = MTD_VISUAL.groupedDonutD;
  const x = leftX + (MTD_VISUAL.leftW - d) / 2;
  const y = topY;
  const segments = model.groupedDonut ?? [];
  shapes.push(
    ...donutRing({
      x,
      y,
      d,
      segments: buildColoredPieSegments(segments.map((s) => ({ percentage: s.percentage, color: s.color }))),
      holeRatio: DONUT_HOLE_RATIO,
      holeFillHex: holeFill,
    }),
  );
  shapes.push(
    textBox({
      x,
      y: y + d / 2 - 10,
      w: d,
      h: 22,
      text: model.groupedDonutCenterLabel,
      sizePt: 14,
      bold: true,
      colorHex: ink,
      align: "ctr",
      anchor: "ctr",
    }),
    textBox({ x, y: y + d / 2 + 10, w: d, h: 14, text: "TOTAL SPEND", sizePt: 9, bold: true, colorHex: muted, align: "ctr", anchor: "ctr" }),
  );
  let legendY = y + d + 16;
  for (const seg of segments) {
    shapes.push(
      rectangle({ x, y: legendY + 2, w: 10, h: 10, fillHex: seg.color }),
      textBox({
        x: x + 14,
        y: legendY,
        w: d - 14,
        h: 14,
        text: `${seg.name} · ${seg.spendLabel} · ${seg.percentage}%`,
        sizePt: 9,
        colorHex: ink,
        align: "l",
        clipOverflow: true,
      }),
    );
    legendY += 16;
  }
}

function appendResultBarsOoxml(shapes: string[], model: VisualChartSlideModel, isLight: boolean): void {
  const c = palette(isLight);
  const cols = resultBarColumns();
  const { rowH, startY } = resultBarGeometry(model.resultBars.length);
  const barH = MTD_VISUAL.barH;

  shapes.push(
    textBox({
      x: MTD_VISUAL.rightX,
      y: MTD_VISUAL.panelY,
      w: MTD_VISUAL.rightW,
      h: MTD_VISUAL.panelHeadingH,
      text: model.rightHeading.toUpperCase(),
      sizePt: 11,
      bold: true,
      colorHex: c.heading,
      align: "l",
    }),
  );

  let rowY = startY;
  for (const bar of model.resultBars) {
    const fillW = resultBarFillWidth(bar.barPct, cols.trackW);
    const barY = rowY + Math.floor((rowH - barH) / 2);
    shapes.push(
      textBox({
        x: cols.labelX,
        y: rowY + 2,
        w: cols.labelColW,
        h: rowH - 4,
        text: truncateCampaignBarName(bar.name),
        sizePt: 9,
        colorHex: c.ink,
        align: "r",
        anchor: "ctr",
        clipOverflow: true,
      }),
      rectangle({ x: cols.barX, y: barY, w: cols.trackW, h: barH, fillHex: c.track }),
    );
    if (fillW > 0) {
      shapes.push(roundedBar({ x: cols.barX, y: barY, w: fillW, h: barH, fillHex: bar.color }));
    }
    shapes.push(
      textBox({
        x: cols.valueX,
        y: rowY + 2,
        w: cols.valueColW,
        h: 14,
        text: `${bar.resultLine} · ${bar.costLine}`,
        sizePt: 9,
        bold: true,
        colorHex: c.ink,
        align: "l",
        clipOverflow: true,
      }),
    );
    rowY += rowH;
  }
}

export function buildMtdOverviewOoxmlShapes(
  chart: ShareChartData,
  background: TemplateBackgroundImage,
  isLightTemplate = false,
): string[] {
  resetShapeIdCounter();
  const model = chart.visualSlide;
  if (!model) {
    throw new Error("ShareChartData.visualSlide is required for MTD overview slide");
  }
  const c = palette(isLightTemplate);
  const holeFill = isLightTemplate ? "ffffff" : "0d1b2e";
  const shapes: string[] = [backgroundImage({ relId: CHART_BG_REL_ID, ...background })];

  shapes.push(
    textBox({
      x: MTD_VISUAL.marginX,
      y: MTD_VISUAL.titleY,
      w: MTD_SLIDE_W - MTD_VISUAL.marginX * 2,
      h: MTD_VISUAL.titleH,
      text: model.title,
      sizePt: 24,
      bold: true,
      colorHex: c.ink,
      align: "ctr",
    }),
  );

  shapes.push(
    roundedCard({
      x: MTD_VISUAL.leftX - 8,
      y: MTD_VISUAL.panelY - 8,
      w: MTD_VISUAL.leftW + 16,
      h: MTD_VISUAL.panelH + 16,
      fillHex: isLightTemplate ? c.panelFill : "111f35",
      strokeHex: c.separator,
      radiusPt: 8,
    }),
    roundedCard({
      x: MTD_VISUAL.rightX - 8,
      y: MTD_VISUAL.panelY - 8,
      w: MTD_VISUAL.rightW + 16,
      h: MTD_VISUAL.panelH + 16,
      fillHex: isLightTemplate ? c.panelFill : "111f35",
      strokeHex: c.separator,
      radiusPt: 8,
    }),
    rectangle({ x: MTD_VISUAL.sepX, y: MTD_VISUAL.panelY, w: 1, h: MTD_VISUAL.panelH, fillHex: c.separator }),
  );

  shapes.push(
    textBox({
      x: MTD_VISUAL.leftX,
      y: MTD_VISUAL.panelY,
      w: MTD_VISUAL.leftW,
      h: MTD_VISUAL.panelHeadingH,
      text: model.leftHeading,
      sizePt: 11,
      bold: true,
      colorHex: c.heading,
      align: "l",
    }),
  );

  if (model.isMultiObjective && model.groupedDonut) {
    appendGroupedDonut(shapes, model, MTD_VISUAL.leftX, MTD_VISUAL.panelY + MTD_VISUAL.panelHeadingH + 24, holeFill, c.ink, c.inkMuted);
  } else {
    const count = model.miniDonuts.length;
    model.miniDonuts.forEach((donut, i) => {
      const pos = miniDonutPosition(i, count);
      appendMiniDonut(shapes, pos.x, pos.y, MTD_VISUAL.miniDonutD, donut.color, donut.spendLabel, donut.name, donut.pctLabel, holeFill, c.ink, c.inkMuted);
    });
    shapes.push(
      textBox({
        x: MTD_VISUAL.leftX,
        y: MTD_VISUAL.panelY + MTD_VISUAL.panelH - 28,
        w: MTD_VISUAL.leftW,
        h: 20,
        text: `Total MTD Spend: ${model.groupedDonutCenterLabel}`,
        sizePt: 11,
        bold: true,
        colorHex: c.ink,
        align: "ctr",
      }),
    );
  }

  appendResultBarsOoxml(shapes, model, isLightTemplate);

  shapes.push(
    textBox({
      x: MTD_VISUAL.marginX,
      y: MTD_VISUAL.summaryY,
      w: MTD_SLIDE_W - MTD_VISUAL.marginX * 2,
      h: MTD_VISUAL.summaryH,
      text: model.summaryLine,
      sizePt: 11,
      colorHex: c.inkMuted,
      align: "ctr",
      anchor: "ctr",
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
