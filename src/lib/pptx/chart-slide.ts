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
import { backgroundImage, buildBlankSlideXml, rectangle, resetShapeIdCounter, textBox } from "./shapes";

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

  const TITLE_H = 34;
  const GAP_TITLE_SUBTITLE = 14;
  const SUBTITLE_H = 24;

  const n = chart.campaigns.length;
  if (n === 0) {
    const totalContentHeight = TITLE_H + GAP_TITLE_SUBTITLE + SUBTITLE_H;
    const contentTop = Math.max(0, (H - totalContentHeight) / 2);
    shapes.push(
      textBox({
        x: 0,
        y: contentTop,
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
        y: contentTop + TITLE_H + GAP_TITLE_SUBTITLE,
        w: W,
        h: SUBTITLE_H,
        text: subtitleText,
        sizePt: 18,
        bold: false,
        colorHex: WHITE,
      }),
    );
    return buildBlankSlideXml(shapes);
  }

  const MARGIN_X = 36;
  const NAME_W = 220;
  const VALUE_W = 110;
  const META_W = 200;
  const BAR_H = 16;
  const ROW_H = Math.min(52, Math.floor((H - 140) / n));
  const TRACK_W = W - MARGIN_X * 2 - NAME_W - VALUE_W - META_W - 24;

  const BLOCK_H = n * ROW_H;
  const GAP_SUBTITLE_BLOCK = 16;
  const totalContentHeight = TITLE_H + GAP_TITLE_SUBTITLE + SUBTITLE_H + GAP_SUBTITLE_BLOCK + BLOCK_H;
  const contentTop = Math.max(16, (H - totalContentHeight) / 2);

  const titleY = contentTop;
  const subtitleY = titleY + TITLE_H + GAP_TITLE_SUBTITLE;
  const blockTopY = subtitleY + SUBTITLE_H + GAP_SUBTITLE_BLOCK;

  shapes.push(
    textBox({
      x: 0,
      y: titleY,
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
      y: subtitleY,
      w: W,
      h: SUBTITLE_H,
      text: subtitleText,
      sizePt: 16,
      bold: false,
      colorHex: WHITE,
    }),
  );

  const maxSpend = Math.max(...chart.campaigns.map((c) => c.spend), 1);

  chart.campaigns.forEach((d, ci) => {
    const globalIndex = colorStartIndex + ci;
    const col = ringColorForCampaign(d, globalIndex);
    const rowY = blockTopY + ci * ROW_H;
    const barY = rowY + Math.floor((ROW_H - BAR_H) / 2) - 2;
    const nameX = MARGIN_X;
    const barX = nameX + NAME_W + 8;
    const valueX = barX + TRACK_W + 8;
    const metaX = valueX + VALUE_W + 4;

    const displayName = d.name.length > 32 ? d.name.slice(0, 32) + "…" : d.name;
    shapes.push(
      textBox({
        x: nameX,
        y: rowY + 4,
        w: NAME_W,
        h: 20,
        text: displayName,
        sizePt: 13,
        bold: true,
        colorHex: WHITE,
        align: "l",
      }),
    );
    if (d.statusIndicator) {
      shapes.push(
        textBox({
          x: nameX,
          y: rowY + 22,
          w: NAME_W,
          h: 14,
          text: d.statusIndicator,
          sizePt: 10,
          bold: true,
          colorHex: INACTIVE_COLOR,
          align: "l",
        }),
      );
    }

    shapes.push(rectangle({ x: barX, y: barY, w: TRACK_W, h: BAR_H, fillHex: TRACK }));
    const fillW = Math.max(d.spend > 0 ? Math.round((d.spend / maxSpend) * TRACK_W) : 4, 4);
    shapes.push(rectangle({ x: barX, y: barY, w: fillW, h: BAR_H, fillHex: col }));

    shapes.push(
      textBox({
        x: valueX,
        y: rowY + 6,
        w: VALUE_W,
        h: 20,
        text: currencySymbol + Math.round(d.spend).toLocaleString("en-US"),
        sizePt: 14,
        bold: true,
        colorHex: WHITE,
        align: "l",
      }),
    );
    shapes.push(
      textBox({
        x: valueX,
        y: rowY + 24,
        w: VALUE_W,
        h: 12,
        text: spendLabel,
        sizePt: 10,
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
          y: rowY + 6,
          w: META_W,
          h: 16,
          text: resultsLine,
          sizePt: 11,
          colorHex: WHITE,
          align: "l",
        }),
      );
    }
    if (cprTxt) {
      shapes.push(
        textBox({
          x: metaX,
          y: rowY + 22,
          w: META_W,
          h: 14,
          text: cprTxt,
          sizePt: 10,
          colorHex: LABEL_COLOR,
          align: "l",
        }),
      );
    }
  });

  return buildBlankSlideXml(shapes);
}
