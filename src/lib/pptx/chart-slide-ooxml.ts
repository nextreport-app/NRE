/**
 * Native OOXML builders for the MTD overview chart slide — editable text,
 * metrics table, and donut ring shapes in PowerPoint and Google Slides.
 */

import type { ShareChartData, ShareDonutSegment } from "../nre/share-report";
import { buildChartMetricsTable } from "../nre/chart-metrics-table";
import { resolveChartFooterInsight } from "../nre/share-chart-projection";
import type { TemplateBackgroundImage } from "./package";
import { CHART_BG_REL_ID, DONUT_HOLE_RATIO } from "./chart-slide-constants";
import { REPORT_HEADER_COLOR, REPORT_HEADER_SIZE_PT } from "./fill-tags";
import {
  METRICS_TABLE_COLORS_DARK,
  METRICS_TABLE_COLORS_LIGHT,
  metricsTableAlign,
  metricsTableColumnWidths,
  metricsTableColumnXs,
  metricsTableFontSize,
  metricsTableRowCells,
  metricsTableRowFill,
  metricsTableRowWeight,
  metricsTableTextColor,
} from "./chart-metrics-table-render";
import { MTD_DONUT, MTD_FOOTER_Y, MTD_METRICS_TABLE, MTD_SLIDE_W } from "./chart-slide-layout";
import {
  backgroundImage,
  buildBlankSlideXml,
  donutRing,
  resetShapeIdCounter,
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

function appendMetricsTableOoxml(
  shapes: string[],
  chart: ShareChartData,
  isLightTemplate: boolean,
): void {
  const palette = isLightTemplate ? METRICS_TABLE_COLORS_LIGHT : METRICS_TABLE_COLORS_DARK;
  const table = buildChartMetricsTable(chart.snapshot, MTD_METRICS_TABLE.maxH);
  const { x: tableX, y: tableY, w: tableW } = MTD_METRICS_TABLE;
  const colXs = metricsTableColumnXs(tableX, tableW);
  const colWs = metricsTableColumnWidths(tableW);

  let rowY = tableY;
  table.rows.forEach((row, rowIndex) => {
    const rowH = table.layout.rowHeights[rowIndex] ?? 24;
    const fill = metricsTableRowFill(row, rowIndex, palette);
    shapes.push(
      roundedCard({
        x: tableX,
        y: rowY,
        w: tableW,
        h: rowH,
        fillHex: fill,
        strokeHex: palette.border,
        radiusPt: rowIndex === 0 ? 6 : 0,
      }),
    );

    const fontSize = metricsTableFontSize(table, row);
    const bold = metricsTableRowWeight(row);
    const color = metricsTableTextColor(row, palette);

    if (row.kind === "footnote") {
      shapes.push(
        textBox({
          x: tableX + 10,
          y: rowY + 2,
          w: tableW - 20,
          h: rowH - 4,
          text: row.label,
          sizePt: fontSize,
          colorHex: color,
          align: "l",
          anchor: "ctr",
        }),
      );
    } else {
      const cells = metricsTableRowCells(row);
      cells.forEach((cell, col) => {
        if (!cell) return;
        const align = metricsTableAlign(col);
        shapes.push(
          textBox({
            x: colXs[col]! + (align === "l" ? 8 : 4),
            y: rowY + 2,
            w: colWs[col]! - 12,
            h: rowH - 4,
            text: cell,
            sizePt: fontSize,
            bold,
            colorHex: color,
            align,
            anchor: "ctr",
          }),
        );
      });
    }
    rowY += rowH;
  });
}

export function buildMtdOverviewOoxmlShapes(
  chart: ShareChartData,
  background: TemplateBackgroundImage,
  isLightTemplate = false,
): string[] {
  resetShapeIdCounter();
  const c = isLightTemplate ? METRICS_TABLE_COLORS_LIGHT : METRICS_TABLE_COLORS_DARK;
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
      colorHex: c.inkMuted,
      align: "ctr",
    }),
  );

  const { x: donutX, y: donutY, d: donutD, cy: donutCy } = MTD_DONUT;

  if (chart.donutSegments.length > 0) {
    shapes.push(
      ...donutRing({
        x: donutX,
        y: donutY,
        d: donutD,
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
      colorHex: c.inkMuted,
      align: "ctr",
      anchor: "ctr",
    }),
  );

  appendMetricsTableOoxml(shapes, chart, isLightTemplate);

  shapes.push(
    textBox({
      x: 40,
      y: MTD_FOOTER_Y.ooxml,
      w: W - 80,
      h: 28,
      text: resolveChartFooterInsight(chart),
      sizePt: 14,
      colorHex: c.inkMuted,
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
