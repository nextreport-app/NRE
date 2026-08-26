/**
 * MTD overview slide — combined account snapshot KPI tiles (Option A) and a
 * spend-mix donut with legend (Option B). All figures are MTD-only from the
 * current month CSV; never weekly or previous-month data.
 *
 * Coordinates in points. Page is 960×540pt.
 */

import type { ChartCampaignData, ChartSlideData } from "../nre/report-data";
import { projectChartSlideToShareChart } from "../nre/share-chart-projection";
import type { TemplateBackgroundImage } from "./package";
import { buildPictureShapeXml } from "./embed-image";
import { buildMtdOverviewSvg } from "./chart-overview-svg";
import { ptToEmu } from "./ooxml";
import { backgroundImage, buildBlankSlideXml, nextShapeId, resetShapeIdCounter } from "./shapes";

/** Relationship id the chart slide's own generated rels (see render.ts) registers the copied background picture under. */
export const CHART_BG_REL_ID = "rId2";
/** Embedded browser-matching overview SVG (see buildChartSlideBundle). */
export const CHART_OVERVIEW_REL_ID = "rId3";
export const CHART_OVERVIEW_MEDIA_FILE = "chart-overview.svg";

/** Legacy export — overview is always one slide now; kept for tests/imports. */
export const CHART_CAMPAIGNS_PER_SLIDE = 8;

export function chunkChartCampaigns<T>(campaigns: T[], _perPage = CHART_CAMPAIGNS_PER_SLIDE): T[][] {
  return campaigns.length === 0 ? [[]] : [campaigns];
}

const CAMPAIGN_COLOR_PALETTE = ["f6ad55", "63b3ed", "68d391", "fc8181", "b794f4", "76e4f7", "f6e05e"];
const EMPTY_RING_COLOR = "9ca3af";
const OTHER_COLOR = "64748b";

function campaignRingColor(index: number): string {
  return CAMPAIGN_COLOR_PALETTE[index % CAMPAIGN_COLOR_PALETTE.length];
}

/** Same per-campaign color the PPT donut and the public share page use. */
export function ringColorForCampaign(d: ChartCampaignData, index: number): string {
  return d.spend > 0 ? campaignRingColor(index) : EMPTY_RING_COLOR;
}

export interface DonutSegment {
  name: string;
  spend: number;
  percentage: number;
  color: string;
}

const MAX_DONUT_SLICES = 5;

/** Top campaigns by MTD spend plus an optional "Other" bucket — drives both PPT and share-page donuts. */
export function buildDonutSegments(campaigns: ChartCampaignData[], totalSpend: number): DonutSegment[] {
  const indexed = campaigns.map((c, i) => ({ c, i }));
  const withSpend = indexed.filter(({ c }) => c.spend > 0).sort((a, b) => b.c.spend - a.c.spend);
  const top = withSpend.slice(0, MAX_DONUT_SLICES);
  const otherSpend = withSpend.slice(MAX_DONUT_SLICES).reduce((sum, { c }) => sum + c.spend, 0);
  const segments: DonutSegment[] = top.map(({ c, i }) => ({
    name: c.name,
    spend: c.spend,
    percentage: totalSpend > 0 ? Math.round((c.spend / totalSpend) * 1000) / 10 : 0,
    color: ringColorForCampaign(c, i),
  }));
  if (otherSpend > 0) {
    segments.push({
      name: "Other",
      spend: otherSpend,
      percentage: totalSpend > 0 ? Math.round((otherSpend / totalSpend) * 1000) / 10 : 0,
      color: OTHER_COLOR,
    });
  }
  return segments;
}

function cprShortForChart(label: string): string {
  return label.replace("COST PER 1K ", "CP 1K ");
}

/** Shared PPT + share-page wording for per-campaign results (legend footnotes). */
export function chartCampaignMetricLines(
  d: ChartCampaignData,
  currencySymbol: string,
): { resultsLine: string; cprLine: string } {
  const shortCpr = cprShortForChart(d.cprLabel);
  if (d.spend <= 0 && d.results <= 0) {
    return { resultsLine: "", cprLine: "" };
  }
  if (d.results > 0) {
    return {
      resultsLine: `${d.results} ${d.resLabel}`,
      cprLine: d.cpr > 0 ? `${currencySymbol}${d.cpr.toFixed(2)} ${shortCpr}` : `N/A ${shortCpr}`,
    };
  }
  return {
    resultsLine: `0 ${d.resLabel}`,
    cprLine: `N/A ${shortCpr}`,
  };
}

export interface ChartSlideRenderOptions {
  continuation?: boolean;
  colorStartIndex?: number;
}

export interface ChartSlideBundle {
  xml: string;
  mediaPath: string;
  mediaBytes: Uint8Array;
}

/** Builds chart slide with template background + embedded SVG overview (matches browser). */
export function buildChartSlideBundle(
  chart: ChartSlideData,
  currencySymbol: string,
  background: TemplateBackgroundImage,
  _isLightTemplate = false,
  _platform: "META" | "GOOGLE" = "META",
  _options: ChartSlideRenderOptions = {},
): ChartSlideBundle {
  resetShapeIdCounter();
  const shareChart = projectChartSlideToShareChart(chart, currencySymbol);
  const svg = buildMtdOverviewSvg(shareChart);
  const mediaBytes = new TextEncoder().encode(svg);

  const shapes: string[] = [
    backgroundImage({ relId: CHART_BG_REL_ID, ...background }),
    buildPictureShapeXml({
      id: nextShapeId(),
      name: "MTD Overview",
      relId: CHART_OVERVIEW_REL_ID,
      x: 0,
      y: 0,
      cx: ptToEmu(960),
      cy: ptToEmu(540),
    }),
  ];

  return {
    xml: buildBlankSlideXml(shapes),
    mediaPath: `ppt/media/${CHART_OVERVIEW_MEDIA_FILE}`,
    mediaBytes,
  };
}

/** @deprecated Prefer buildChartSlideBundle — kept for tests that only need slide XML. */
export function buildChartSlideXml(
  chart: ChartSlideData,
  currencySymbol: string,
  background: TemplateBackgroundImage,
  isLightTemplate = false,
  platform: "META" | "GOOGLE" = "META",
  options: ChartSlideRenderOptions = {},
): string {
  return buildChartSlideBundle(chart, currencySymbol, background, isLightTemplate, platform, options).xml;
}
