/**
 * SVG renderer for the month-to-date overview slide — mirrors
 * share-report-view.tsx's MtdOverviewSlide layout so PPT/Google Slides match
 * the live browser link. Background is transparent; the template grid shows
 * through from the slide layer beneath this PNG overlay.
 */

import type { ShareChartData } from "../nre/share-report";
import { buildChartMetricsTable } from "../nre/chart-metrics-table";
import { resolveChartFooterInsight } from "../nre/share-chart-projection";
import { DONUT_HOLE_RATIO } from "./chart-slide-constants";
import {
  METRICS_TABLE_COLORS_DARK,
  metricsTableAlign,
  metricsTableColumnWidths,
  metricsTableColumnXs,
  metricsTableFontSize,
  metricsTableRowCells,
  metricsTableRowFill,
  metricsTableRowWeight,
  metricsTableTextColor,
} from "./chart-metrics-table-render";
import { MTD_DONUT, MTD_FOOTER_Y, MTD_METRICS_TABLE, MTD_SLIDE_H, MTD_SLIDE_W } from "./chart-slide-layout";

const INK = "#ffffff";
const TITLE = "#94a3b8";
const INK_SUBTITLE = "#e2e8f0";
const LEGEND_STATS = "#94a3b8";

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function donutSegmentPath(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startDeg: number,
  endDeg: number,
): string {
  const toRad = (d: number) => ((d - 90) * Math.PI) / 180;
  const large = endDeg - startDeg > 180 ? 1 : 0;
  const sO = { x: cx + outerR * Math.cos(toRad(startDeg)), y: cy + outerR * Math.sin(toRad(startDeg)) };
  const eO = { x: cx + outerR * Math.cos(toRad(endDeg)), y: cy + outerR * Math.sin(toRad(endDeg)) };
  const sI = { x: cx + innerR * Math.cos(toRad(endDeg)), y: cy + innerR * Math.sin(toRad(endDeg)) };
  const eI = { x: cx + innerR * Math.cos(toRad(startDeg)), y: cy + innerR * Math.sin(toRad(startDeg)) };
  return [
    `M ${sO.x.toFixed(2)} ${sO.y.toFixed(2)}`,
    `A ${outerR} ${outerR} 0 ${large} 1 ${eO.x.toFixed(2)} ${eO.y.toFixed(2)}`,
    `L ${sI.x.toFixed(2)} ${sI.y.toFixed(2)}`,
    `A ${innerR} ${innerR} 0 ${large} 0 ${eI.x.toFixed(2)} ${eI.y.toFixed(2)}`,
    "Z",
  ].join(" ");
}

function appendDonutSegment(
  parts: string[],
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startDeg: number,
  sweepDeg: number,
  color: string,
): void {
  if (sweepDeg <= 0) return;
  if (sweepDeg >= 359.9) {
    parts.push(`<path d="${donutSegmentPath(cx, cy, outerR, innerR, 0, 180)}" fill="#${color}"/>`);
    parts.push(`<path d="${donutSegmentPath(cx, cy, outerR, innerR, 180, 360)}" fill="#${color}"/>`);
    return;
  }
  parts.push(
    `<path d="${donutSegmentPath(cx, cy, outerR, innerR, startDeg, startDeg + sweepDeg)}" fill="#${color}"/>`,
  );
}

function appendMetricsTableSvg(
  parts: string[],
  chart: ShareChartData,
): void {
  const colors = METRICS_TABLE_COLORS_DARK;
  const table = buildChartMetricsTable(chart.snapshot, MTD_METRICS_TABLE.maxH);
  const { x: tableX, y: tableY, w: tableW } = MTD_METRICS_TABLE;
  const colXs = metricsTableColumnXs(tableX, tableW);
  const colWs = metricsTableColumnWidths(tableW);
  const border = `#${colors.border}`;

  let rowY = tableY;
  table.rows.forEach((row, rowIndex) => {
    const rowH = table.layout.rowHeights[rowIndex] ?? 24;
    const fill = `#${metricsTableRowFill(row, rowIndex, colors)}`;
    parts.push(
      `<rect x="${tableX}" y="${rowY}" width="${tableW}" height="${rowH}" fill="${fill}" stroke="${border}" stroke-width="1"/>`,
    );

    if (row.kind === "footnote") {
      parts.push(
        `<text x="${tableX + 12}" y="${rowY + rowH / 2 + 4}" fill="#${colors.inkMuted}" font-family="Poppins" font-size="${metricsTableFontSize(table, row)}" font-weight="500">${escapeXml(row.label)}</text>`,
      );
    } else {
      const cells = metricsTableRowCells(row);
      const fontSize = metricsTableFontSize(table, row);
      const weight = metricsTableRowWeight(row) ? 700 : 500;
      const textColor = `#${metricsTableTextColor(row, colors)}`;
      cells.forEach((cell, col) => {
        if (!cell) return;
        const align = metricsTableAlign(col);
        const anchor = align === "l" ? "start" : "end";
        const tx = align === "l" ? colXs[col]! + 10 : colXs[col]! + colWs[col]! - 10;
        parts.push(
          `<text x="${tx}" y="${rowY + rowH / 2 + 4}" text-anchor="${anchor}" fill="${textColor}" font-family="Poppins" font-size="${fontSize}" font-weight="${weight}">${escapeXml(cell)}</text>`,
        );
      });
    }
    rowY += rowH;
  });
}

export function buildMtdOverviewSvg(chart: ShareChartData): string {
  const W = MTD_SLIDE_W;
  const H = MTD_SLIDE_H;
  const parts: string[] = [];

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`,
  );

  parts.push(
    `<text x="${W / 2}" y="48" text-anchor="middle" fill="${TITLE}" font-family="Poppins" font-size="24" font-weight="700">${escapeXml(chart.title)}</text>`,
    `<text x="${W / 2}" y="74" text-anchor="middle" fill="${INK_SUBTITLE}" font-family="Poppins" font-size="16" font-weight="500">${escapeXml(chart.subtitle)}</text>`,
  );

  const { cx: donutCx, cy: donutCy, outerR } = MTD_DONUT;
  const innerR = outerR * DONUT_HOLE_RATIO;

  let angle = 0;
  for (const seg of chart.donutSegments) {
    const sweep = (seg.percentage / 100) * 360;
    appendDonutSegment(parts, donutCx, donutCy, outerR, innerR, angle, sweep, seg.color);
    angle += sweep;
  }

  parts.push(
    `<text x="${donutCx}" y="${donutCy - 4}" text-anchor="middle" fill="${INK}" font-family="Poppins" font-size="22" font-weight="700">${escapeXml(chart.totalSpendLabel)}</text>`,
    `<text x="${donutCx}" y="${donutCy + 16}" text-anchor="middle" fill="${INK_SUBTITLE}" font-family="Poppins" font-size="11" font-weight="600">TOTAL SPEND</text>`,
  );

  appendMetricsTableSvg(parts, chart);

  parts.push(
    `<text x="${W / 2}" y="${MTD_FOOTER_Y.svg}" text-anchor="middle" fill="${INK_SUBTITLE}" font-family="Poppins" font-size="14" font-weight="500">${escapeXml(resolveChartFooterInsight(chart))}</text>`,
  );

  parts.push("</svg>");
  return parts.join("");
}
