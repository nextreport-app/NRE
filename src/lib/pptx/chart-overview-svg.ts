/**
 * SVG renderer for the MTD Visual Chart slide — mirrors chart-slide-ooxml layout.
 */

import type { ShareChartData } from "../nre/share-report";
import { MTD_SLIDE_W, MTD_SLIDE_H, MTD_VISUAL, miniDonutPosition, resultBarGeometry } from "./chart-slide-layout";
import { resultBarColumns, resultBarFillWidth, truncateCampaignBarName } from "./chart-campaign-bars-render";

const INK = "#ffffff";
const MUTED = "#94a3b8";
const TRACK = "#1e293b";
const PANEL = "#111f35";
const SEP = "#1e3a5f";

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function truncateCaption(name: string, pctLabel: string, max = 32): string {
  const full = `${name} · ${pctLabel}`;
  return full.length > max ? `${full.slice(0, max - 1)}…` : full;
}

export function buildMtdOverviewSvg(chart: ShareChartData): string {
  const model = chart.visualSlide;
  if (!model) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${MTD_SLIDE_W} ${MTD_SLIDE_H}" width="${MTD_SLIDE_W}" height="${MTD_SLIDE_H}"></svg>`;
  }

  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${MTD_SLIDE_W} ${MTD_SLIDE_H}" width="${MTD_SLIDE_W}" height="${MTD_SLIDE_H}">`,
    `<rect x="0" y="0" width="${MTD_SLIDE_W}" height="${MTD_SLIDE_H}" fill="#0d1b2e"/>`,
    `<text x="${MTD_SLIDE_W / 2}" y="46" text-anchor="middle" fill="${MUTED}" font-family="Poppins" font-size="24" font-weight="700">${escapeXml(model.title)}</text>`,
    `<rect x="${MTD_VISUAL.leftX - 8}" y="${MTD_VISUAL.panelY - 8}" width="${MTD_VISUAL.leftW + 16}" height="${MTD_VISUAL.panelH + 16}" rx="8" fill="${PANEL}" stroke="${SEP}"/>`,
    `<rect x="${MTD_VISUAL.rightX - 8}" y="${MTD_VISUAL.panelY - 8}" width="${MTD_VISUAL.rightW + 16}" height="${MTD_VISUAL.panelH + 16}" rx="8" fill="${PANEL}" stroke="${SEP}"/>`,
    `<line x1="${MTD_VISUAL.sepX}" y1="${MTD_VISUAL.panelY}" x2="${MTD_VISUAL.sepX}" y2="${MTD_VISUAL.panelY + MTD_VISUAL.panelH}" stroke="${SEP}"/>`,
    `<text x="${MTD_VISUAL.leftX}" y="${MTD_VISUAL.panelY + 18}" fill="${MUTED}" font-family="Poppins" font-size="16" font-weight="700">${escapeXml(model.leftHeading)}</text>`,
    `<text x="${MTD_VISUAL.rightX}" y="${MTD_VISUAL.panelY + 18}" fill="${MUTED}" font-family="Poppins" font-size="16" font-weight="700">${escapeXml(model.rightHeading.toUpperCase())}</text>`,
  ];

  if (model.isMultiObjective && model.groupedDonut) {
    const d = MTD_VISUAL.groupedDonutD;
    const x = MTD_VISUAL.leftX + (MTD_VISUAL.leftW - d) / 2;
    const y = MTD_VISUAL.panelY + 36;
    parts.push(`<circle cx="${x + d / 2}" cy="${y + d / 2}" r="${d / 2 - 8}" fill="none" stroke="#f6ad55" stroke-width="14"/>`);
    parts.push(
      `<text x="${x + d / 2}" y="${y + d / 2}" text-anchor="middle" fill="${INK}" font-family="Poppins" font-size="20" font-weight="700">${escapeXml(model.groupedDonutCenterLabel)}</text>`,
    );
  } else {
    model.miniDonuts.forEach((donut, i) => {
      const pos = miniDonutPosition(i, model.miniDonuts.length);
      const cx = pos.x + pos.d / 2;
      const cy = pos.y + pos.d / 2;
      parts.push(`<circle cx="${cx}" cy="${cy}" r="${pos.d / 2 - 8}" fill="none" stroke="#${donut.color}" stroke-width="14"/>`);
      parts.push(`<text x="${cx}" y="${cy + 5}" text-anchor="middle" fill="${INK}" font-family="Poppins" font-size="14" font-weight="700">${escapeXml(donut.spendLabel)}</text>`);
      parts.push(
        `<text x="${cx}" y="${pos.y + pos.d + 16}" text-anchor="middle" fill="${MUTED}" font-family="Poppins" font-size="11">${escapeXml(truncateCaption(donut.name, donut.pctLabel))}</text>`,
      );
    });
    parts.push(
      `<text x="${MTD_VISUAL.leftX + MTD_VISUAL.leftW / 2}" y="${MTD_VISUAL.panelY + MTD_VISUAL.panelH - 14}" text-anchor="middle" fill="${INK}" font-family="Poppins" font-size="16" font-weight="700">Total Spend: ${escapeXml(model.groupedDonutCenterLabel)}</text>`,
    );
  }

  const cols = resultBarColumns();
  const { rowH, startY } = resultBarGeometry(model.resultBars.length);
  let rowY = startY;
  for (const bar of model.resultBars) {
    const fillW = resultBarFillWidth(bar.barPct, cols.trackW);
    const barBlockH = MTD_VISUAL.barH + MTD_VISUAL.barMetricsH;
    const barY = rowY + Math.max(0, (rowH - barBlockH) / 2);
    const metricsY = barY + MTD_VISUAL.barH + 16;
    parts.push(
      `<text x="${cols.labelX + cols.labelColW}" y="${rowY + rowH / 2 + 5}" text-anchor="end" fill="${INK}" font-family="Poppins" font-size="15">${escapeXml(truncateCampaignBarName(bar.name, 20))}</text>`,
      `<rect x="${cols.barX}" y="${barY}" width="${cols.trackW}" height="${MTD_VISUAL.barH}" rx="3" fill="${TRACK}"/>`,
    );
    if (fillW > 0) {
      parts.push(`<rect x="${cols.barX}" y="${barY}" width="${fillW}" height="${MTD_VISUAL.barH}" rx="3" fill="#${bar.color}"/>`);
    }
    parts.push(
      `<text x="${cols.barX}" y="${metricsY}" fill="${INK}" font-family="Poppins" font-size="15" font-weight="700">${escapeXml(bar.statLine)}</text>`,
    );
    rowY += rowH;
  }

  parts.push(
    `<text x="${MTD_SLIDE_W / 2}" y="${MTD_VISUAL.summaryY + 20}" text-anchor="middle" fill="${MUTED}" font-family="Poppins" font-size="15">${escapeXml(model.summaryLine)}</text>`,
    "</svg>",
  );
  return parts.join("");
}
