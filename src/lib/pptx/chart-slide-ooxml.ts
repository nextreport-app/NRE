/**
 * Native OOXML builders for the MTD Visual Chart slide — single-panel leaderboard.
 */

import type { ShareChartData } from "../nre/share-report";
import type { VisualChartSlideModel } from "../nre/visual-chart-slide";
import type { TemplateBackgroundImage } from "./package";
import { CHART_BG_REL_ID } from "./chart-slide-constants";
import { VISUAL_CHART_TITLE_SIZE_PT } from "./fill-tags";
import { reportHeaderColor } from "./light-theme-colors";
import {
  resultBarColumns,
  resultBarFillWidth,
  VISUAL_CHART_COLORS_DARK,
  VISUAL_CHART_COLORS_LIGHT,
} from "./chart-campaign-bars-render";
import {
  MTD_SLIDE_W,
  MTD_VISUAL,
  resultBarLayout,
} from "./chart-slide-layout";
import { appendGroupedDonutOoxml } from "./chart-grouped-donut-render";
import { ptToEmu } from "./ooxml";
import {
  backgroundImage,
  buildBlankSlideXml,
  nextShapeId,
  rectangle,
  resetShapeIdCounter,
  roundedCard,
  textBox,
} from "./shapes";

function palette(isLight: boolean) {
  return isLight ? VISUAL_CHART_COLORS_LIGHT : VISUAL_CHART_COLORS_DARK;
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

function appendResultBarsOoxml(shapes: string[], model: VisualChartSlideModel, isLight: boolean): void {
  const c = palette(isLight);
  const splitPanel = model.useSplitPanel && model.groupedDonut != null && model.groupedDonut.length > 0;
  const cols = resultBarColumns(splitPanel);
  const hasSubheading = Boolean(model.panelSubheading?.trim());
  const layout = resultBarLayout(model.resultBars.length, hasSubheading);
  const heading = splitPanel ? model.rightHeading : model.panelHeading || model.rightHeading;
  const panelX = splitPanel ? MTD_VISUAL.rightX : MTD_VISUAL.fullPanelX;
  const panelW = splitPanel ? MTD_VISUAL.rightW : MTD_VISUAL.fullPanelW;

  if (splitPanel) {
    shapes.push(
      textBox({
        x: MTD_VISUAL.leftX,
        y: MTD_VISUAL.panelY,
        w: MTD_VISUAL.leftW,
        h: MTD_VISUAL.panelHeadingH,
        text: model.leftHeading.toUpperCase(),
        sizePt: 16,
        bold: true,
        colorHex: c.heading,
        align: "l",
      }),
      rectangle({
        x: MTD_VISUAL.sepX,
        y: MTD_VISUAL.panelY + 8,
        w: 1,
        h: MTD_VISUAL.panelH - 16,
        fillHex: c.separator,
      }),
    );
    appendGroupedDonutOoxml(shapes, {
      segments: model.groupedDonut!,
      centerLabel: model.groupedDonutCenterLabel,
      panelTopY: MTD_VISUAL.panelY,
      leftX: MTD_VISUAL.leftX,
      leftW: MTD_VISUAL.leftW,
      isLight,
      colors: { inkMuted: c.inkMuted, panelFill: c.panelFill },
    });
  }

  shapes.push(
    textBox({
      x: panelX,
      y: MTD_VISUAL.panelY,
      w: panelW,
      h: MTD_VISUAL.panelHeadingH,
      text: heading.toUpperCase(),
      sizePt: 16,
      bold: true,
      colorHex: c.heading,
      align: "l",
    }),
  );

  if (hasSubheading) {
    shapes.push(
      textBox({
        x: MTD_VISUAL.fullPanelX,
        y: MTD_VISUAL.panelY + MTD_VISUAL.panelHeadingH + MTD_VISUAL.panelSubheadingGap,
        w: MTD_VISUAL.fullPanelW,
        h: MTD_VISUAL.panelSubheadingH,
        text: model.panelSubheading,
        sizePt: 12,
        colorHex: c.inkMuted,
        align: "l",
        anchor: "t",
        clipOverflow: true,
        nowrap: true,
      }),
    );
  }

  let rowY = layout.startY;
  for (const bar of model.resultBars) {
    const fillW = resultBarFillWidth(bar.barPct, cols.trackW);
    const nameY = rowY;
    const metricsY = rowY + layout.nameH + layout.nameMetricsGap;
    const barY = metricsY + layout.metricsH + layout.metricsBarGap;

    shapes.push(
      textBox({
        x: cols.barX,
        y: nameY,
        w: cols.trackW,
        h: layout.nameH,
        text: `${bar.rank}. ${bar.name}`,
        sizePt: layout.nameSizePt,
        bold: true,
        colorHex: c.ink,
        align: "l",
        anchor: "t",
        clipOverflow: true,
        nowrap: true,
      }),
      textBox({
        x: cols.barX,
        y: metricsY,
        w: cols.trackW,
        h: layout.metricsH,
        text: bar.statLine,
        sizePt: layout.metricsSizePt,
        bold: true,
        colorHex: c.inkMuted,
        align: "l",
        anchor: "t",
        clipOverflow: true,
        nowrap: true,
      }),
      rectangle({ x: cols.barX, y: barY, w: cols.trackW, h: layout.barH, fillHex: c.track }),
    );
    if (fillW > 0) {
      shapes.push(roundedBar({ x: cols.barX, y: barY, w: fillW, h: layout.barH, fillHex: bar.color }));
    }
    rowY += layout.rowH;
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
  const shapes: string[] = [backgroundImage({ relId: CHART_BG_REL_ID, ...background })];

  shapes.push(
    textBox({
      x: MTD_VISUAL.marginX,
      y: MTD_VISUAL.titleY,
      w: MTD_SLIDE_W - MTD_VISUAL.marginX * 2,
      h: MTD_VISUAL.titleH,
      text: model.title,
      sizePt: VISUAL_CHART_TITLE_SIZE_PT,
      bold: true,
      colorHex: reportHeaderColor(isLightTemplate),
      align: "ctr",
      anchor: "t",
      clipOverflow: true,
    }),
  );

  shapes.push(
    roundedCard({
      x: MTD_VISUAL.fullPanelX - 6,
      y: MTD_VISUAL.panelY - 6,
      w: MTD_VISUAL.fullPanelW + 12,
      h: MTD_VISUAL.panelH + 12,
      fillHex: isLightTemplate ? c.panelFill : "111f35",
      strokeHex: c.separator,
      radiusPt: 8,
    }),
  );

  appendResultBarsOoxml(shapes, model, isLightTemplate);

  shapes.push(
    textBox({
      x: MTD_VISUAL.marginX,
      y: MTD_VISUAL.summaryY,
      w: MTD_SLIDE_W - MTD_VISUAL.marginX * 2,
      h: MTD_VISUAL.summaryH,
      text: model.summaryLine,
      sizePt: 15,
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
