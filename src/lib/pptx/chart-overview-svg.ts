/**
 * SVG renderer for the month-to-date overview slide — mirrors
 * share-report-view.tsx's MtdOverviewSlide layout so PPT/Google Slides match
 * the live browser link.
 */

import type { ShareChartData } from "../nre/share-report";
import {
  buildChartCampaignBars,
  buildChartKpiCardRows,
  computeMtdVisualBandMetrics,
} from "../nre/chart-visual-layout";
import { resolveChartFooterInsight, formatDonutSegmentStats } from "../nre/share-chart-projection";
import {
  campaignBarColumns,
  campaignBarFillWidth,
  CAMPAIGN_BAR_COLORS_DARK,
  truncateCampaignBarName,
} from "./chart-campaign-bars-render";
import { DONUT_HOLE_RATIO } from "./chart-slide-constants";
import {
  MTD_CAMPAIGN_BARS,
  MTD_DONUT_D,
  MTD_DONUT_OUTER_R,
  MTD_FOOTER_Y,
  MTD_KPI,
  MTD_SLIDE_H,
  MTD_SLIDE_W,
  mtdDonutCenterX,
} from "./chart-slide-layout";

const INK = "#ffffff";
const TITLE = "#94a3b8";
const INK_SUBTITLE = "#e2e8f0";
const ACCENT_ORANGE = "#f6ad55";
const KPI_BG = "#131d30";
const KPI_BORDER = "#1e293b";

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

function appendKpiCardsSvg(parts: string[], chart: ShareChartData): void {
  const cardRows = buildChartKpiCardRows(chart.snapshot);
  const W = MTD_SLIDE_W;

  if (cardRows.mode === "single") {
    const { y: kpiY, singleRowH: kpiH, singleCardW: kpiW, gap: kpiGap } = MTD_KPI;
    const row = cardRows.rows[0] ?? [];
    const kpiStartX = (W - (4 * kpiW + 3 * kpiGap)) / 2;
    row.forEach((tile, i) => {
      const x = kpiStartX + i * (kpiW + kpiGap);
      parts.push(
        `<rect x="${x}" y="${kpiY}" width="${kpiW}" height="${kpiH}" rx="8" fill="${KPI_BG}" stroke="${KPI_BORDER}" stroke-width="1"/>`,
        `<text x="${x + kpiW / 2}" y="${kpiY + 38}" text-anchor="middle" fill="${INK}" font-family="Poppins" font-size="22" font-weight="700">${escapeXml(tile.value)}</text>`,
        `<text x="${x + kpiW / 2}" y="${kpiY + 62}" text-anchor="middle" fill="${ACCENT_ORANGE}" font-family="Poppins" font-size="10" font-weight="600">${escapeXml(tile.label.toUpperCase())}</text>`,
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
    parts.push(
      `<rect x="${x}" y="${accountY}" width="${accountW}" height="${accountH}" rx="8" fill="${KPI_BG}" stroke="${KPI_BORDER}" stroke-width="1"/>`,
      `<text x="${x + accountW / 2}" y="${accountY + 32}" text-anchor="middle" fill="${INK}" font-family="Poppins" font-size="22" font-weight="700">${escapeXml(tile.value)}</text>`,
      `<text x="${x + accountW / 2}" y="${accountY + 54}" text-anchor="middle" fill="${ACCENT_ORANGE}" font-family="Poppins" font-size="10" font-weight="600">${escapeXml(tile.label.toUpperCase())}</text>`,
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
    parts.push(
      `<rect x="${x}" y="${objY}" width="${objW}" height="${objH}" rx="8" fill="${KPI_BG}" stroke="${KPI_BORDER}" stroke-width="1"/>`,
      `<text x="${x + objW / 2}" y="${objY + 16}" text-anchor="middle" fill="${ACCENT_ORANGE}" font-family="Poppins" font-size="9" font-weight="600">${escapeXml(card.label.toUpperCase())}</text>`,
      `<text x="${x + objW / 2}" y="${objY + 40}" text-anchor="middle" fill="${INK}" font-family="Poppins" font-size="22" font-weight="700">${escapeXml(card.value)}</text>`,
    );
    if (card.detail) {
      parts.push(
        `<text x="${x + objW / 2}" y="${objY + 58}" text-anchor="middle" fill="${INK_SUBTITLE}" font-family="Poppins" font-size="10" font-weight="500">${escapeXml(card.detail)}</text>`,
      );
    }
  });
}

function appendCampaignBarsSvg(
  parts: string[],
  chart: ShareChartData,
  barsY: number,
  barRowH: number,
  headerH: number,
): void {
  const colors = CAMPAIGN_BAR_COLORS_DARK;
  const bars = buildChartCampaignBars(chart.donutSegments);
  const cols = campaignBarColumns();
  const { x: areaX } = MTD_CAMPAIGN_BARS as { x: number };

  parts.push(
    `<text x="${areaX}" y="${barsY + 14}" fill="${ACCENT_ORANGE}" font-family="Poppins" font-size="11" font-weight="700">CAMPAIGN SPEND MIX</text>`,
  );

  let rowY = barsY + headerH;
  for (const bar of bars) {
    const fillW = campaignBarFillWidth(bar.percentage, cols.trackW);
    const barH = 14;
    const barY = rowY + Math.floor((barRowH - barH) / 2);
    parts.push(
      `<text x="${cols.labelX}" y="${rowY + barRowH / 2 + 4}" fill="${INK}" font-family="Poppins" font-size="13" font-weight="600">${escapeXml(truncateCampaignBarName(bar.name))}</text>`,
      `<rect x="${cols.barX}" y="${barY}" width="${cols.trackW}" height="${barH}" rx="4" fill="#${colors.track}"/>`,
    );
    if (fillW > 0) {
      parts.push(
        `<rect x="${cols.barX}" y="${barY}" width="${fillW}" height="${barH}" rx="4" fill="#${bar.color}"/>`,
      );
    }
    parts.push(
      `<text x="${cols.valueX + cols.valueColW}" y="${rowY + 12}" text-anchor="end" fill="${INK}" font-family="Poppins" font-size="13" font-weight="700">${escapeXml(bar.spendLabel)}</text>`,
      `<text x="${cols.valueX + cols.valueColW}" y="${rowY + 28}" text-anchor="end" fill="#${colors.inkMuted}" font-family="Poppins" font-size="11" font-weight="500">${escapeXml(formatDonutSegmentStats(bar.percentage, bar.spendLabel).split(" · ")[0] ?? "")}</text>`,
    );
    rowY += barRowH;
  }

  if (bars.length === 0) {
    parts.push(
      `<text x="${areaX}" y="${rowY + 20}" fill="${INK_SUBTITLE}" font-family="Poppins" font-size="13">No spend recorded this month yet.</text>`,
    );
  }
}

export function buildMtdOverviewSvg(chart: ShareChartData): string {
  const W = MTD_SLIDE_W;
  const H = MTD_SLIDE_H;
  const parts: string[] = [];
  const cardRows = buildChartKpiCardRows(chart.snapshot);
  const bars = buildChartCampaignBars(chart.donutSegments);
  const band = computeMtdVisualBandMetrics(cardRows, bars.length);
  const donutCx = mtdDonutCenterX();
  const donutCy = band.donutCy;
  const innerR = MTD_DONUT_OUTER_R * DONUT_HOLE_RATIO;

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`,
  );

  parts.push(
    `<text x="${W / 2}" y="48" text-anchor="middle" fill="${TITLE}" font-family="Poppins" font-size="24" font-weight="700">${escapeXml(chart.title)}</text>`,
    `<text x="${W / 2}" y="74" text-anchor="middle" fill="${INK_SUBTITLE}" font-family="Poppins" font-size="16" font-weight="500">${escapeXml(chart.subtitle)}</text>`,
  );

  appendKpiCardsSvg(parts, chart);

  let angle = 0;
  for (const seg of chart.donutSegments) {
    const sweep = (seg.percentage / 100) * 360;
    appendDonutSegment(parts, donutCx, donutCy, MTD_DONUT_OUTER_R, innerR, angle, sweep, seg.color);
    angle += sweep;
  }

  parts.push(
    `<text x="${donutCx}" y="${donutCy - 4}" text-anchor="middle" fill="${INK}" font-family="Poppins" font-size="22" font-weight="700">${escapeXml(chart.totalSpendLabel)}</text>`,
    `<text x="${donutCx}" y="${donutCy + 16}" text-anchor="middle" fill="${INK_SUBTITLE}" font-family="Poppins" font-size="11" font-weight="600">TOTAL SPEND</text>`,
  );

  appendCampaignBarsSvg(parts, chart, band.barsY, band.barRowH, band.barsHeaderH);

  parts.push(
    `<text x="${W / 2}" y="${MTD_FOOTER_Y.svg}" text-anchor="middle" fill="${INK_SUBTITLE}" font-family="Poppins" font-size="14" font-weight="500">${escapeXml(resolveChartFooterInsight(chart))}</text>`,
  );

  parts.push("</svg>");
  return parts.join("");
}
