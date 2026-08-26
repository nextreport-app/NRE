/**
 * MTD overview slide utilities — donut segments, colors, and shared helpers.
 * Server-side slide assembly (PNG rasterization) lives in chart-slide-render.ts.
 *
 * Coordinates in points. Page is 960×540pt.
 */

import type { ChartCampaignData } from "../nre/report-data";

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

export { CHART_BG_REL_ID, CHART_OVERVIEW_REL_ID, CHART_OVERVIEW_MEDIA_FILE } from "./chart-slide-constants";
