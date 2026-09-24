/**
 * SVG renderer for the MTD Visual Chart slide — mirrors chart-slide-ooxml layout.
 */

import type { ShareChartData } from "../nre/share-report";
import {
  MTD_SLIDE_W,
  MTD_SLIDE_H,
  MTD_VISUAL,
  resultBarLayout,
} from "./chart-slide-layout";
import { buildGroupedDonutSvg, splitPanelSeparatorSvg } from "./chart-grouped-donut-render";
import { resultBarColumns, resultBarFillWidth } from "./chart-campaign-bars-render";

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

export function buildMtdOverviewSvg(chart: ShareChartData): string {
  const model = chart.visualSlide;
  if (!model) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${MTD_SLIDE_W} ${MTD_SLIDE_H}" width="${MTD_SLIDE_W}" height="${MTD_SLIDE_H}"></svg>`;
  }

  const splitPanel = model.useSplitPanel && model.groupedDonut != null && model.groupedDonut.length > 0;
  const heading = splitPanel ? model.rightHeading : model.panelHeading || model.rightHeading;
  const panelX = splitPanel ? MTD_VISUAL.rightX : MTD_VISUAL.fullPanelX;
  const hasSubheading = Boolean(model.panelSubheading?.trim());
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${MTD_SLIDE_W} ${MTD_SLIDE_H}" width="${MTD_SLIDE_W}" height="${MTD_SLIDE_H}">`,
    `<rect x="0" y="0" width="${MTD_SLIDE_W}" height="${MTD_SLIDE_H}" fill="#0d1b2e"/>`,
    `<text x="${MTD_SLIDE_W / 2}" y="${MTD_VISUAL.titleY + 28}" text-anchor="middle" fill="${MUTED}" font-family="Poppins" font-size="24" font-weight="700">${escapeXml(model.title)}</text>`,
    `<rect x="${MTD_VISUAL.fullPanelX - 8}" y="${MTD_VISUAL.panelY - 8}" width="${MTD_VISUAL.fullPanelW + 16}" height="${MTD_VISUAL.panelH + 16}" rx="8" fill="${PANEL}" stroke="${SEP}"/>`,
  ];

  if (splitPanel) {
    parts.push(
      `<text x="${MTD_VISUAL.leftX}" y="${MTD_VISUAL.panelY + 18}" fill="${MUTED}" font-family="Poppins" font-size="16" font-weight="700">${escapeXml(model.leftHeading.toUpperCase())}</text>`,
      splitPanelSeparatorSvg(),
      ...buildGroupedDonutSvg({
        segments: model.groupedDonut!,
        centerLabel: model.groupedDonutCenterLabel,
        panelTopY: MTD_VISUAL.panelY,
        leftX: MTD_VISUAL.leftX,
        leftW: MTD_VISUAL.leftW,
        panelFill: PANEL,
      }),
    );
  }

  parts.push(
    `<text x="${panelX}" y="${MTD_VISUAL.panelY + 18}" fill="${MUTED}" font-family="Poppins" font-size="16" font-weight="700">${escapeXml(heading.toUpperCase())}</text>`,
  );

  if (hasSubheading) {
    parts.push(
      `<text x="${MTD_VISUAL.fullPanelX}" y="${MTD_VISUAL.panelY + MTD_VISUAL.panelHeadingH + MTD_VISUAL.panelSubheadingGap + 12}" fill="${MUTED}" font-family="Poppins" font-size="12">${escapeXml(model.panelSubheading)}</text>`,
    );
  }

  const cols = resultBarColumns(splitPanel);
  const barLayout = resultBarLayout(model.resultBars.length, hasSubheading);
  let rowY = barLayout.startY;
  for (const bar of model.resultBars) {
    const fillW = resultBarFillWidth(bar.barPct, cols.trackW);
    const nameY = rowY + barLayout.nameH - 2;
    const metricsY = rowY + barLayout.nameH + barLayout.nameMetricsGap + barLayout.metricsH - 2;
    const barY = rowY + barLayout.nameH + barLayout.nameMetricsGap + barLayout.metricsH + barLayout.metricsBarGap;
    parts.push(
      `<text x="${cols.barX}" y="${nameY}" fill="${INK}" font-family="Poppins" font-size="${barLayout.nameSizePt}" font-weight="700">${escapeXml(`${bar.rank}. ${bar.name}`)}</text>`,
      `<text x="${cols.barX}" y="${metricsY}" fill="${MUTED}" font-family="Poppins" font-size="${barLayout.metricsSizePt}" font-weight="700">${escapeXml(bar.statLine)}</text>`,
      `<rect x="${cols.barX}" y="${barY}" width="${cols.trackW}" height="${barLayout.barH}" rx="3" fill="${TRACK}"/>`,
    );
    if (fillW > 0) {
      parts.push(`<rect x="${cols.barX}" y="${barY}" width="${fillW}" height="${barLayout.barH}" rx="3" fill="#${bar.color}"/>`);
    }
    rowY += barLayout.rowH;
  }

  parts.push(
    `<text x="${MTD_SLIDE_W / 2}" y="${MTD_VISUAL.summaryY + 20}" text-anchor="middle" fill="${MUTED}" font-family="Poppins" font-size="15">${escapeXml(model.summaryLine)}</text>`,
    "</svg>",
  );
  return parts.join("");
}
