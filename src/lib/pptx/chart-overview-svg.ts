/**
 * SVG renderer for the month-to-date overview slide — mirrors
 * share-report-view.tsx's MtdOverviewSlide layout so PPT/Google Slides match
 * the live browser link. Background is transparent; the template grid shows
 * through from the slide layer beneath this PNG overlay.
 */

import type { ShareChartData } from "../nre/share-report";
import { resolveChartFooterInsight, formatDonutSegmentStats } from "../nre/share-chart-projection";
import { DONUT_HOLE_RATIO } from "./chart-slide-constants";

const INK = "#ffffff";
/** Same muted grey as every other slide's main heading (REPORT_HEADER_COLOR). */
const TITLE = "#94a3b8";
/** Brighter than browser muted — reads clearly on Slides after PNG rasterization. */
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

/** Donut ring segment path — angles in degrees, 0° = top, clockwise. */
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

/** A single 360° arc is degenerate in SVG — draw two semicircles instead. */
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

export function buildMtdOverviewSvg(chart: ShareChartData): string {
  const W = 960;
  const H = 540;
  const parts: string[] = [];

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`,
  );

  // Title + subtitle (match browser hierarchy; brighter/larger for Slides readability)
  parts.push(
    `<text x="${W / 2}" y="48" text-anchor="middle" fill="${TITLE}" font-family="Poppins" font-size="24" font-weight="700">${escapeXml(chart.title)}</text>`,
    `<text x="${W / 2}" y="74" text-anchor="middle" fill="${INK_SUBTITLE}" font-family="Poppins" font-size="16" font-weight="500">${escapeXml(chart.subtitle)}</text>`,
  );

  // KPI tiles — 4 across
  const kpiY = 92;
  const kpiW = 200;
  const kpiH = 88;
  const kpiGap = 16;
  const kpiStartX = (W - (4 * kpiW + 3 * kpiGap)) / 2;
  const kpiTiles = [
    { value: chart.snapshot.mtdSpendLabel, label: "AD SPEND THIS MONTH" },
    { value: chart.snapshot.primaryResultsValue, label: chart.snapshot.primaryResultsLabel.toUpperCase() },
    { value: chart.snapshot.primaryCprValue, label: chart.snapshot.primaryCprLabel.toUpperCase() },
    { value: chart.snapshot.budgetPctUsed || "—", label: chart.snapshot.budgetPctUsed ? "BUDGET USED" : "BUDGET" },
  ];
  kpiTiles.forEach((tile, i) => {
    const x = kpiStartX + i * (kpiW + kpiGap);
    parts.push(
      `<rect x="${x}" y="${kpiY}" width="${kpiW}" height="${kpiH}" rx="8" fill="${KPI_BG}" stroke="${KPI_BORDER}" stroke-width="1"/>`,
      `<text x="${x + kpiW / 2}" y="${kpiY + 38}" text-anchor="middle" fill="${INK}" font-family="Poppins" font-size="22" font-weight="700">${escapeXml(tile.value)}</text>`,
      `<text x="${x + kpiW / 2}" y="${kpiY + 62}" text-anchor="middle" fill="${ACCENT_ORANGE}" font-family="Poppins" font-size="10" font-weight="600">${escapeXml(tile.label)}</text>`,
    );
  });

  // Donut + legend
  const donutCx = 220;
  const donutCy = 310;
  const outerR = 110;
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

  // Legend
  let legendY = 220;
  const legendX = 380;
  const LEGEND_STATS = "#94a3b8";
  for (const seg of chart.donutSegments) {
    parts.push(
      `<rect x="${legendX}" y="${legendY}" width="14" height="14" rx="2" fill="#${seg.color}"/>`,
      `<text x="${legendX + 22}" y="${legendY + 12}" fill="${INK}" font-family="Poppins" font-size="13" font-weight="700">${escapeXml(seg.name)}</text>`,
      `<text x="${legendX + 22}" y="${legendY + 28}" fill="${LEGEND_STATS}" font-family="Poppins" font-size="12" font-weight="500">${escapeXml(formatDonutSegmentStats(seg.percentage, seg.spendLabel))}</text>`,
    );
    legendY += 40;
  }

  parts.push(
    `<text x="${W / 2}" y="488" text-anchor="middle" fill="${INK_SUBTITLE}" font-family="Poppins" font-size="14" font-weight="500">${escapeXml(resolveChartFooterInsight(chart))}</text>`,
  );

  parts.push("</svg>");
  return parts.join("");
}
