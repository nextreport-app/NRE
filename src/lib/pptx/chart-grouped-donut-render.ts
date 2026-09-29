/**
 * Shared grouped-donut geometry for the visual chart split panel (OOXML + SVG).
 */

import type { VisualChartSegment } from "../nre/visual-chart-slide";
import { formatGroupedDonutLegendEntry } from "../nre/visual-chart-slide";
import { DONUT_HOLE_RATIO } from "./chart-slide-constants";
import { groupedDonutLayout, MTD_VISUAL } from "./chart-slide-layout";
import { donutRing, rectangle, textBox, type DonutRingSegment } from "./shapes";

const LEGEND_SWATCH_PT = 10;
const LEGEND_SWATCH_GAP = 6;

export function visualChartSegmentsToRing(segments: VisualChartSegment[]): DonutRingSegment[] {
  let cursor = -90;
  return segments
    .filter((seg) => seg.percentage > 0)
    .map((seg) => {
      const sweep = (seg.percentage / 100) * 360;
      const startDeg = cursor;
      cursor += sweep;
      return { startDeg, endDeg: cursor, fillHex: seg.color };
    });
}

export interface GroupedDonutRenderColors {
  inkMuted: string;
  panelFill: string;
}

export function appendGroupedDonutOoxml(
  shapes: string[],
  opts: {
    segments: VisualChartSegment[];
    centerLabel: string;
    panelTopY: number;
    leftX: number;
    leftW: number;
    isLight: boolean;
    colors: GroupedDonutRenderColors;
  },
): void {
  const layout = groupedDonutLayout(opts.segments.length, opts.panelTopY);
  const donutX = opts.leftX + (opts.leftW - layout.donutD) / 2;
  const donutY = layout.blockTopY;
  const holeFill = opts.isLight ? opts.colors.panelFill : "111f35";

  shapes.push(
    ...donutRing({
      x: donutX,
      y: donutY,
      d: layout.donutD,
      segments: visualChartSegmentsToRing(opts.segments),
      holeRatio: DONUT_HOLE_RATIO,
      holeFillHex: holeFill,
    }),
    textBox({
      x: donutX,
      y: donutY + layout.donutD / 2 - 14,
      w: layout.donutD,
      h: 28,
      text: opts.centerLabel,
      sizePt: 18,
      bold: true,
      colorHex: opts.colors.inkMuted,
      align: "ctr",
      anchor: "ctr",
    }),
  );

  let legendY = donutY + layout.donutD + 16;
  const legendTextX = opts.leftX + 8 + LEGEND_SWATCH_PT + LEGEND_SWATCH_GAP;
  const legendTextW = opts.leftW - 16 - LEGEND_SWATCH_PT - LEGEND_SWATCH_GAP;
  for (const seg of opts.segments) {
    shapes.push(
      rectangle({
        x: opts.leftX + 8,
        y: legendY + Math.max(0, (layout.legendRowH - LEGEND_SWATCH_PT) / 2),
        w: LEGEND_SWATCH_PT,
        h: LEGEND_SWATCH_PT,
        fillHex: seg.color,
      }),
      textBox({
        x: legendTextX,
        y: legendY,
        w: legendTextW,
        h: layout.legendRowH,
        text: formatGroupedDonutLegendEntry(seg),
        sizePt: layout.legendSizePt,
        colorHex: opts.colors.inkMuted,
        align: "l",
        anchor: "t",
        clipOverflow: true,
        nowrap: false,
      }),
    );
    legendY += layout.legendRowH + layout.legendRowGap;
  }
}

export function buildGroupedDonutSvg(opts: {
  segments: VisualChartSegment[];
  centerLabel: string;
  panelTopY: number;
  leftX: number;
  leftW: number;
  panelFill: string;
}): string[] {
  const layout = groupedDonutLayout(opts.segments.length, opts.panelTopY);
  const donutX = opts.leftX + (opts.leftW - layout.donutD) / 2;
  const donutY = layout.blockTopY;
  const cx = donutX + layout.donutD / 2;
  const cy = donutY + layout.donutD / 2;
  const outerR = layout.donutD / 2;
  const innerR = outerR * DONUT_HOLE_RATIO;
  const parts: string[] = [];

  let cursor = -90;
  for (const seg of opts.segments) {
    if (seg.percentage <= 0) continue;
    const sweep = (seg.percentage / 100) * 360;
    const start = cursor;
    const end = cursor + sweep;
    cursor = end;
    const startRad = (start * Math.PI) / 180;
    const endRad = (end * Math.PI) / 180;
    const x1 = cx + outerR * Math.cos(startRad);
    const y1 = cy + outerR * Math.sin(startRad);
    const x2 = cx + outerR * Math.cos(endRad);
    const y2 = cy + outerR * Math.sin(endRad);
    const xi1 = cx + innerR * Math.cos(endRad);
    const yi1 = cy + innerR * Math.sin(endRad);
    const xi2 = cx + innerR * Math.cos(startRad);
    const yi2 = cy + innerR * Math.sin(startRad);
    const largeArc = sweep > 180 ? 1 : 0;
    parts.push(
      `<path d="M ${x1} ${y1} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2} L ${xi1} ${yi1} A ${innerR} ${innerR} 0 ${largeArc} 0 ${xi2} ${yi2} Z" fill="#${seg.color}"/>`,
    );
  }

  parts.push(
    `<text x="${cx}" y="${cy + 6}" text-anchor="middle" fill="#94a3b8" font-family="Poppins" font-size="18" font-weight="700">${escapeXml(opts.centerLabel)}</text>`,
  );

  let legendY = donutY + layout.donutD + 16;
  const legendTextX = opts.leftX + 8 + LEGEND_SWATCH_PT + LEGEND_SWATCH_GAP;
  for (const seg of opts.segments) {
    const swatchY = legendY + Math.max(0, (layout.legendRowH - LEGEND_SWATCH_PT) / 2);
    parts.push(
      `<rect x="${opts.leftX + 8}" y="${swatchY}" width="${LEGEND_SWATCH_PT}" height="${LEGEND_SWATCH_PT}" rx="2" fill="#${seg.color}"/>`,
      `<text x="${legendTextX}" y="${legendY + layout.legendRowH - 4}" fill="#94a3b8" font-family="Poppins" font-size="${layout.legendSizePt}">${escapeXml(formatGroupedDonutLegendEntry(seg))}</text>`,
    );
    legendY += layout.legendRowH + layout.legendRowGap;
  }

  return parts;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function splitPanelSeparatorSvg(): string {
  return `<line x1="${MTD_VISUAL.sepX}" y1="${MTD_VISUAL.panelY + 8}" x2="${MTD_VISUAL.sepX}" y2="${MTD_VISUAL.panelY + MTD_VISUAL.panelH - 8}" stroke="#1e3a5f" stroke-width="1"/>`;
}
