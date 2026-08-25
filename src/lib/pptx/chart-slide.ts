/**
 * MTD performance chart slide — horizontal spend-mix bars (one row per
 * campaign), replacing the older one-donut-per-campaign layout. Colors still
 * come from ringColorForCampaign so the share page and PPT stay in sync.
 *
 * All coordinates are in points. Page is 960x540pt.
 */

import { fmtNumber } from "../nre/format";
import type { ChartCampaignData, ChartSlideData } from "../nre/report-data";
import type { TemplateBackgroundImage } from "./package";
import { REPORT_HEADER_COLOR } from "./fill-tags";
import { backgroundImage, buildBlankSlideXml, rectangle, resetShapeIdCounter, roundedCard, textBox } from "./shapes";

/** Relationship id the chart slide's own generated rels (see render.ts) registers the copied background picture under. */
export const CHART_BG_REL_ID = "rId2";

/** How many campaign bars fit one visual slide before a continuation slide is added. */
export const CHART_CAMPAIGNS_PER_SLIDE = 8;

export function chunkChartCampaigns<T>(campaigns: T[], perPage = CHART_CAMPAIGNS_PER_SLIDE): T[][] {
  if (campaigns.length === 0) return [[]];
  const pages: T[][] = [];
  for (let i = 0; i < campaigns.length; i += perPage) {
    pages.push(campaigns.slice(i, i + perPage));
  }
  return pages;
}

const LABEL_COLOR_DARK = "7ab0cc";
const TEXT_COLOR_DARK = "FFFFFF";
const TRACK_COLOR_DARK = "1e293b";

const LABEL_COLOR_LIGHT = "1E3A5F";
const TEXT_COLOR_LIGHT = "0D1B2E";
const TRACK_COLOR_LIGHT = "e2e8f0";

const INACTIVE_COLOR = "fbbf24";

const CAMPAIGN_COLOR_PALETTE = [
  "f6ad55",
  "63b3ed",
  "68d391",
  "fc8181",
  "b794f4",
  "76e4f7",
  "f6e05e",
];

function campaignRingColor(index: number): string {
  return CAMPAIGN_COLOR_PALETTE[index % CAMPAIGN_COLOR_PALETTE.length];
}

const EMPTY_RING_COLOR = "9ca3af";

/** Same per-campaign color the PPT bar and the public share page use. */
export function ringColorForCampaign(d: ChartCampaignData, index: number): string {
  return d.spend > 0 ? campaignRingColor(index) : EMPTY_RING_COLOR;
}

function cprShortForChart(label: string): string {
  return label.replace("COST PER 1K ", "CP 1K ");
}

export interface ChartSlideRenderOptions {
  /** True on page 2+ when campaigns overflow one visual slide. */
  continuation?: boolean;
  /** Index of the first campaign on this page in the full account list — keeps palette colors stable across continuation slides. */
  colorStartIndex?: number;
}

export function buildChartSlideXml(
  chart: ChartSlideData,
  currencySymbol: string,
  background: TemplateBackgroundImage,
  isLightTemplate = false,
  platform: "META" | "GOOGLE" = "META",
  options: ChartSlideRenderOptions = {},
): string {
  resetShapeIdCounter();

  const LABEL_COLOR = isLightTemplate ? LABEL_COLOR_LIGHT : LABEL_COLOR_DARK;
  const WHITE = isLightTemplate ? TEXT_COLOR_LIGHT : TEXT_COLOR_DARK;
  const TRACK = isLightTemplate ? TRACK_COLOR_LIGHT : TRACK_COLOR_DARK;
  const HEADING_COLOR = REPORT_HEADER_COLOR;
  const spendLabel = platform === "GOOGLE" ? "COST" : "AD SPEND";
  const colorStartIndex = options.colorStartIndex ?? 0;
  const continuation = options.continuation === true;

  const W = 960;
  const H = 540;
  const shapes: string[] = [];

  const hasSubLabel = chart.periodSubLabel.length > 0;
  const baseTitle = chart.mtdMonthName
    ? `${chart.mtdMonthName} Campaign Performance`
    : (chart.periodLabel === "MTD" ? "MTD" : "WEEKLY") + " CAMPAIGN PERFORMANCE";
  const titled = continuation ? `${baseTitle} (continued from previous slide)` : baseTitle;
  const chartTitle = hasSubLabel ? `${titled}: ${chart.periodSubLabel}` : titled;
  const TITLE_SIZE_PT = 28;

  shapes.push(backgroundImage({ relId: CHART_BG_REL_ID, ...background }));

  const activeCount = chart.activeCampaignCount;
  const spendPeriodLabel = chart.periodLabel === "MTD" ? "Month to Date" : chart.periodLabel;
  const subtitleText = continuation
    ? `In continuation from previous slide     ·     ${spendLabel} mix`
    : `Total ${spendPeriodLabel} Spend:  ` +
      currencySymbol +
      Math.round(chart.totalAllSpend).toLocaleString("en-US") +
      `     ·     ${activeCount} Active Campaign${activeCount === 1 ? "" : "s"}`;

  const TITLE_Y = 18;
  const TITLE_H = 36;
  const SUBTITLE_Y = 56;
  const SUBTITLE_H = 22;

  const n = chart.campaigns.length;
  shapes.push(
    textBox({
      x: 0,
      y: TITLE_Y,
      w: W,
      h: TITLE_H,
      text: chartTitle,
      sizePt: TITLE_SIZE_PT,
      bold: true,
      colorHex: HEADING_COLOR,
    }),
  );
  shapes.push(
    textBox({
      x: 0,
      y: SUBTITLE_Y,
      w: W,
      h: SUBTITLE_H,
      text: subtitleText,
      sizePt: 16,
      bold: false,
      colorHex: WHITE,
    }),
  );

  if (n === 0) {
    return buildBlankSlideXml(shapes);
  }

  const MARGIN_X = 36;
  const NAME_W = 248;
  const VALUE_W = 128;
  const META_W = 220;
  const BAR_H = 22;
  const ROW_GAP = 8;
  const blockTopY = 88;
  const availableH = H - blockTopY - 20;
  const ROW_H = Math.min(56, Math.max(44, Math.floor(availableH / n)));
  const TRACK_W = W - MARGIN_X * 2 - NAME_W - VALUE_W - META_W - 28;

  const maxSpend = Math.max(...chart.campaigns.map((c) => c.spend), 1);

  chart.campaigns.forEach((d, ci) => {
    const globalIndex = colorStartIndex + ci;
    const col = ringColorForCampaign(d, globalIndex);
    const rowY = blockTopY + ci * ROW_H;
    const innerY = rowY + 4;
    const barY = innerY + Math.floor((ROW_H - 8 - BAR_H) / 2);
    const nameX = MARGIN_X;
    const barX = nameX + NAME_W + 10;
    const valueX = barX + TRACK_W + 10;
    const metaX = valueX + VALUE_W + 6;

    shapes.push(
      roundedCard({
        x: MARGIN_X - 8,
        y: rowY,
        w: W - (MARGIN_X - 8) * 2,
        h: ROW_H - ROW_GAP,
        fillHex: isLightTemplate ? "f8fafc" : "152033",
        strokeHex: isLightTemplate ? "cbd5e1" : "1e3a5f",
        radiusPt: 8,
      }),
    );
    shapes.push(rectangle({ x: MARGIN_X - 8, y: rowY, w: 4, h: ROW_H - ROW_GAP, fillHex: col }));

    const displayName = d.name.length > 36 ? d.name.slice(0, 36) + "…" : d.name;
    shapes.push(
      textBox({
        x: nameX,
        y: innerY + 6,
        w: NAME_W,
        h: 22,
        text: displayName,
        sizePt: 16,
        bold: true,
        colorHex: WHITE,
        align: "l",
      }),
    );
    if (d.statusIndicator) {
      shapes.push(
        textBox({
          x: nameX,
          y: innerY + 28,
          w: NAME_W,
          h: 14,
          text: d.statusIndicator,
          sizePt: 11,
          bold: true,
          colorHex: INACTIVE_COLOR,
          align: "l",
        }),
      );
    }

    shapes.push(rectangle({ x: barX, y: barY, w: TRACK_W, h: BAR_H, fillHex: TRACK }));
    const fillW = Math.max(d.spend > 0 ? Math.round((d.spend / maxSpend) * TRACK_W) : 6, 6);
    shapes.push(rectangle({ x: barX, y: barY, w: fillW, h: BAR_H, fillHex: col }));

    shapes.push(
      textBox({
        x: valueX,
        y: innerY + 4,
        w: VALUE_W,
        h: 22,
        text: currencySymbol + Math.round(d.spend).toLocaleString("en-US"),
        sizePt: 16,
        bold: true,
        colorHex: WHITE,
        align: "l",
      }),
    );
    shapes.push(
      textBox({
        x: valueX,
        y: innerY + 26,
        w: VALUE_W,
        h: 14,
        text: spendLabel,
        sizePt: 11,
        colorHex: LABEL_COLOR,
        align: "l",
      }),
    );

    const resultsLine = d.results > 0 ? `${fmtNumber(d.results)} ${d.resLabel}` : "";
    const cprTxt = d.cpr > 0 ? `${currencySymbol}${d.cpr.toFixed(2)} ${cprShortForChart(d.cprLabel)}` : "";
    if (resultsLine) {
      shapes.push(
        textBox({
          x: metaX,
          y: innerY + 4,
          w: META_W,
          h: 20,
          text: resultsLine,
          sizePt: 14,
          bold: true,
          colorHex: WHITE,
          align: "l",
        }),
      );
    }
    if (cprTxt) {
      shapes.push(
        textBox({
          x: metaX,
          y: innerY + 24,
          w: META_W,
          h: 16,
          text: cprTxt,
          sizePt: 12,
          colorHex: LABEL_COLOR,
          align: "l",
        }),
      );
    }
  });

  return buildBlankSlideXml(shapes);
}
