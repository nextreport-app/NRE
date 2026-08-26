/**
 * MTD overview slide — combined account snapshot KPI tiles (Option A) and a
 * spend-mix donut with legend (Option B). All figures are MTD-only from the
 * current month CSV; never weekly or previous-month data.
 *
 * Coordinates in points. Page is 960×540pt.
 */

import type { ChartCampaignData, ChartSlideData } from "../nre/report-data";
import type { TemplateBackgroundImage } from "./package";
import { REPORT_HEADER_COLOR } from "./fill-tags";
import { backgroundImage, buildBlankSlideXml, donutRing, resetShapeIdCounter, roundedCard, textBox } from "./shapes";

/** Relationship id the chart slide's own generated rels (see render.ts) registers the copied background picture under. */
export const CHART_BG_REL_ID = "rId2";

/** Legacy export — overview is always one slide now; kept for tests/imports. */
export const CHART_CAMPAIGNS_PER_SLIDE = 8;

export function chunkChartCampaigns<T>(campaigns: T[], _perPage = CHART_CAMPAIGNS_PER_SLIDE): T[][] {
  return campaigns.length === 0 ? [[]] : [campaigns];
}

const LABEL_COLOR_DARK = "7ab0cc";
const TEXT_COLOR_DARK = "FFFFFF";
const LABEL_COLOR_LIGHT = "1E3A5F";
const TEXT_COLOR_LIGHT = "0D1B2E";
const CARD_FILL_DARK = "131d30";
const CARD_STROKE_DARK = "2a4365";
const CARD_FILL_LIGHT = "f8fafc";
const CARD_STROKE_LIGHT = "cbd5e1";

const CAMPAIGN_COLOR_PALETTE = ["f6ad55", "63b3ed", "68d391", "fc8181", "b794f4", "76e4f7", "f6e05e"];
const EMPTY_RING_COLOR = "9ca3af";
const OTHER_COLOR = "64748b";
/** Inner hole size — matches share-report-view conic-gradient mask (52%). */
const DONUT_HOLE_RATIO = 0.52;
const DONUT_HOLE_FILL_DARK = "0d1b2e";

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

function kpiTile(
  x: number,
  y: number,
  w: number,
  h: number,
  value: string,
  label: string,
  isLight: boolean,
): string[] {
  const fill = isLight ? CARD_FILL_LIGHT : CARD_FILL_DARK;
  const stroke = isLight ? CARD_STROKE_LIGHT : CARD_STROKE_DARK;
  const white = isLight ? TEXT_COLOR_LIGHT : TEXT_COLOR_DARK;
  return [
    roundedCard({ x, y, w, h, fillHex: fill, strokeHex: stroke, radiusPt: 10 }),
    textBox({ x, y: y + 10, w, h: 28, text: value, sizePt: 22, bold: true, colorHex: white, align: "ctr" }),
    textBox({ x, y: y + h - 22, w, h: 16, text: label, sizePt: 10, colorHex: LABEL_COLOR_DARK, align: "ctr" }),
  ];
}

function truncateName(name: string, max = 32): string {
  return name.length > max ? name.slice(0, max) + "…" : name;
}

export interface ChartSlideRenderOptions {
  continuation?: boolean;
  colorStartIndex?: number;
}

export function buildChartSlideXml(
  chart: ChartSlideData,
  currencySymbol: string,
  background: TemplateBackgroundImage,
  isLightTemplate = false,
  platform: "META" | "GOOGLE" = "META",
  _options: ChartSlideRenderOptions = {},
): string {
  resetShapeIdCounter();

  const WHITE = isLightTemplate ? TEXT_COLOR_LIGHT : TEXT_COLOR_DARK;
  const HEADING_COLOR = REPORT_HEADER_COLOR;
  const spendLabel = platform === "GOOGLE" ? "COST" : "AD SPEND";

  const W = 960;
  const shapes: string[] = [];

  const month = chart.mtdMonthName ?? "MTD";
  const rangeSuffix = chart.periodSubLabel.length > 0 ? `: ${chart.periodSubLabel}` : "";
  const title = `${month} MTD Overview${rangeSuffix}`;
  const subtitle = "Month-to-date performance  ·  Where your budget went";

  shapes.push(backgroundImage({ relId: CHART_BG_REL_ID, ...background }));
  shapes.push(textBox({ x: 0, y: 16, w: W, h: 34, text: title, sizePt: 26, bold: true, colorHex: HEADING_COLOR }));
  shapes.push(textBox({ x: 0, y: 50, w: W, h: 20, text: subtitle, sizePt: 14, bold: false, colorHex: WHITE }));

  const snap = chart.snapshot;
  const KPI_Y = 82;
  const KPI_H = 72;
  const KPI_GAP = 12;
  const KPI_W = (W - 72 - KPI_GAP * 3) / 4;
  let kpiX = 36;
  const kpiTiles: { value: string; label: string }[] = [
    { value: snap.mtdSpendFormatted, label: `MTD ${spendLabel}` },
    { value: snap.primaryResultsValue, label: snap.primaryResultsLabel },
    { value: snap.primaryCprValue, label: snap.primaryCprLabel.replace("COST PER ", "COST PER ") },
    { value: snap.budgetPctUsed || "—", label: snap.budgetPctUsed ? "BUDGET USED" : "BUDGET" },
  ];
  for (const tile of kpiTiles) {
    shapes.push(...kpiTile(kpiX, KPI_Y, KPI_W, KPI_H, tile.value, tile.label, isLightTemplate));
    kpiX += KPI_W + KPI_GAP;
  }

  const DONUT_Y = 168;
  const DONUT_D = 220;
  const DONUT_X = 120;
  const segments = buildDonutSegments(chart.campaigns, chart.totalAllSpend);

  if (segments.length === 0) {
    shapes.push(
      textBox({
        x: 36,
        y: DONUT_Y + 80,
        w: W - 72,
        h: 40,
        text: "No MTD spend recorded this month.",
        sizePt: 16,
        colorHex: WHITE,
      }),
    );
    return buildBlankSlideXml(shapes);
  }

  let angle = -90;
  const ringSegments: { startDeg: number; endDeg: number; fillHex: string }[] = [];
  for (const seg of segments) {
    const sweep = (seg.percentage / 100) * 360;
    if (sweep <= 0) continue;
    ringSegments.push({ startDeg: angle, endDeg: angle + sweep, fillHex: seg.color });
    angle += sweep;
  }
  const holeFill = isLightTemplate ? CARD_FILL_LIGHT : DONUT_HOLE_FILL_DARK;
  shapes.push(
    ...donutRing({
      x: DONUT_X,
      y: DONUT_Y,
      d: DONUT_D,
      segments: ringSegments,
      holeRatio: DONUT_HOLE_RATIO,
      holeFillHex: holeFill,
    }),
  );

  shapes.push(
    textBox({
      x: DONUT_X,
      y: DONUT_Y + DONUT_D / 2 - 28,
      w: DONUT_D,
      h: 32,
      text: currencySymbol + Math.round(chart.totalAllSpend).toLocaleString("en-US"),
      sizePt: 22,
      bold: true,
      colorHex: WHITE,
    }),
  );
  shapes.push(
    textBox({
      x: DONUT_X,
      y: DONUT_Y + DONUT_D / 2 + 4,
      w: DONUT_D,
      h: 18,
      text: "TOTAL MTD",
      sizePt: 10,
      colorHex: LABEL_COLOR_DARK,
    }),
  );

  const LEGEND_X = 420;
  let legendY = DONUT_Y + 8;
  const LEGEND_W = W - LEGEND_X - 36;
  for (const seg of segments) {
    shapes.push(roundedCard({ x: LEGEND_X, y: legendY, w: 14, h: 14, fillHex: seg.color, strokeHex: seg.color, radiusPt: 3 }));
    const line = `${truncateName(seg.name)}  ·  ${seg.percentage}%  ·  ${currencySymbol}${Math.round(seg.spend).toLocaleString("en-US")}`;
    shapes.push(
      textBox({
        x: LEGEND_X + 22,
        y: legendY - 2,
        w: LEGEND_W - 22,
        h: 20,
        text: line,
        sizePt: 13,
        bold: false,
        colorHex: WHITE,
        align: "l",
        clipOverflow: true,
      }),
    );
    legendY += 28;
  }

  const insight =
    `${snap.activeCampaignCount} active campaign${snap.activeCampaignCount === 1 ? "" : "s"} MTD` +
    (snap.budgetPctUsed ? `  ·  ${snap.budgetPctUsed} of monthly budget used` : "");
  shapes.push(textBox({ x: 36, y: 468, w: W - 72, h: 20, text: insight, sizePt: 12, colorHex: LABEL_COLOR_DARK, align: "ctr" }));

  return buildBlankSlideXml(shapes);
}
