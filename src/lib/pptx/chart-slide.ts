/**
 * MTD performance chart slide — a from-scratch OOXML port of
 * addVisualScorecardSlide_ from meta_ads_report_v4.js (one donut circle per
 * campaign: outer colored ring + inner dark circle showing spend, with
 * results/CPR below, and a spend-proportion bar along the bottom).
 *
 * All coordinates are in points, matching the source's Slides API calls
 * 1:1 — the source's own comments confirm the page is 960x540pt, identical
 * to this template's slide size, so no coordinate rescaling is needed.
 */

import { fmtNumber } from "../nre/format";
import type { ChartSlideData } from "../nre/report-data";
import type { TemplateBackgroundImage } from "./package";
import { backgroundImage, buildBlankSlideXml, ellipse, rectangle, resetShapeIdCounter, textBox } from "./shapes";

/** Relationship id the chart slide's own generated rels (see render.ts) registers the copied background picture under. */
export const CHART_BG_REL_ID = "rId2";

// Dark navy — matches the template's own background picture closely enough
// that painting it over a small area (the donut "hole") reads as a flat
// content surface rather than a visible patch, the same way the template's
// own metric cards sit on solid fills over that background rather than
// showing the grid/gradient through them. Deliberately not grey: grey is
// reserved for this inner hole alone (see CAMPAIGN_COLOR_PALETTE below) and
// must never appear as a ring color, so a real campaign's ring is never
// mistaken for "no campaign here."
const BG_COLOR = "0d1b2e";
const LABEL_COLOR = "7ab0cc";
const INACTIVE_COLOR = "fbbf24"; // amber — "Paused"/"Inactive" indicator under a non-active campaign's name
const WHITE = "FFFFFF";

/**
 * Fix 3 — campaign ring colors are assigned by INDEX (the order campaigns
 * appear in the data), not by objective/result label. The previous
 * objective-keyed lookup (LEADS/CLICKS/REACH/...) silently fell back to a
 * shared grey for any objective outside that short list — PURCHASES among
 * them, a very common one — so multiple different campaigns all rendered
 * the same grey ring with no way to tell them apart. Cycling through 7
 * fixed colors by index instead means every campaign gets a real color, and
 * consecutive campaigns are never the same: any two adjacent indexes differ
 * by 1, and 1 is never a multiple of 7, so `i % 7` and `(i+1) % 7` always
 * land on different palette entries — true no matter how many campaigns
 * there are, not just up to 7.
 */
const CAMPAIGN_COLOR_PALETTE = [
  "f6ad55", // orange
  "63b3ed", // blue
  "68d391", // green
  "fc8181", // coral/red
  "b794f4", // purple
  "76e4f7", // cyan
  "f6e05e", // yellow
];

function campaignRingColor(index: number): string {
  return CAMPAIGN_COLOR_PALETTE[index % CAMPAIGN_COLOR_PALETTE.length];
}

function cprShortForChart(label: string): string {
  return label.replace("COST PER 1K ", "CP 1K ");
}

export function buildChartSlideXml(chart: ChartSlideData, currencySymbol: string, background: TemplateBackgroundImage): string {
  resetShapeIdCounter();

  const W = 960;
  const H = 540;
  const shapes: string[] = [];

  shapes.push(backgroundImage({ relId: CHART_BG_REL_ID, ...background }));
  shapes.push(
    textBox({
      x: 0,
      y: 8,
      w: W,
      h: 34,
      text: (chart.periodLabel === "MTD" ? "MTD" : "WEEKLY") + " CAMPAIGN PERFORMANCE",
      sizePt: 28,
      bold: true,
      colorHex: WHITE,
    }),
  );

  const activeCount = chart.activeCampaignCount;
  shapes.push(
    textBox({
      x: 0,
      y: 44,
      w: W,
      h: 24,
      text:
        `Total ${chart.periodLabel} Spend:  ` +
        currencySymbol +
        Math.round(chart.totalAllSpend).toLocaleString("en-US") +
        `     ·     ${activeCount} Active Campaign${activeCount === 1 ? "" : "s"}`,
      sizePt: 18,
      bold: false,
      colorHex: WHITE,
    }),
  );

  const n = chart.campaigns.length;
  if (n === 0) return buildBlankSlideXml(shapes);

  const MARGIN = 20;
  const COL_W = Math.floor((W - MARGIN * (n + 1)) / n);
  const CIRCLE_D = Math.min(COL_W - 20, 200);
  const INNER_D = Math.round(CIRCLE_D * 0.7);
  const CIRC_Y = 158;

  chart.campaigns.forEach((d, ci) => {
    const col = campaignRingColor(ci);
    const colX = MARGIN + ci * (COL_W + MARGIN);
    const cx = colX + Math.floor(COL_W / 2);
    const circX = cx - Math.floor(CIRCLE_D / 2);

    const displayName = d.name.length > 40 ? d.name.slice(0, 40) + "…" : d.name;
    shapes.push(
      textBox({ x: colX, y: CIRC_Y - 36, w: COL_W, h: 28, text: displayName, sizePt: 14, colorHex: WHITE }),
    );
    if (d.statusIndicator) {
      shapes.push(
        textBox({
          x: colX,
          y: CIRC_Y - 8,
          w: COL_W,
          h: 14,
          text: d.statusIndicator,
          sizePt: 10,
          bold: true,
          colorHex: INACTIVE_COLOR,
        }),
      );
    }

    const circTopY = CIRC_Y + 18;
    shapes.push(ellipse({ x: circX, y: circTopY, d: CIRCLE_D, fillHex: col }));

    const innerOffset = Math.floor((CIRCLE_D - INNER_D) / 2);
    shapes.push(ellipse({ x: circX + innerOffset, y: circTopY + innerOffset, d: INNER_D, fillHex: BG_COLOR }));

    const centerY = circTopY + Math.floor(CIRCLE_D / 2);
    const textBoxW = INNER_D - 10;
    const textBoxX = cx - Math.floor(textBoxW / 2);

    shapes.push(
      textBox({
        x: textBoxX,
        y: centerY - 22,
        w: textBoxW,
        h: 24,
        text: currencySymbol + Math.round(d.spend).toLocaleString("en-US"),
        sizePt: n <= 2 ? 20 : 16,
        bold: true,
        colorHex: WHITE,
      }),
    );
    shapes.push(
      textBox({ x: textBoxX, y: centerY + 4, w: textBoxW, h: 12, text: "AD SPEND", sizePt: 11, colorHex: LABEL_COLOR }),
    );

    const belowY = circTopY + CIRCLE_D + 10;
    shapes.push(rectangle({ x: cx - 30, y: belowY, w: 60, h: 1, fillHex: col }));

    shapes.push(
      textBox({
        x: colX,
        y: belowY + 6,
        w: COL_W,
        h: 28,
        text: fmtNumber(d.results),
        sizePt: n <= 2 ? 28 : 24,
        bold: true,
        colorHex: WHITE,
      }),
    );
    shapes.push(
      textBox({ x: colX, y: belowY + 36, w: COL_W, h: 12, text: d.resLabel, sizePt: 11, colorHex: LABEL_COLOR }),
    );

    const cprTxt = d.cpr > 0 ? currencySymbol + d.cpr.toFixed(2) : "—";
    shapes.push(
      textBox({
        x: colX,
        y: belowY + 52,
        w: COL_W,
        h: 24,
        text: cprTxt,
        sizePt: n <= 2 ? 20 : 17,
        bold: true,
        colorHex: WHITE,
      }),
    );
    shapes.push(
      textBox({
        x: colX,
        y: belowY + 76,
        w: COL_W,
        h: 12,
        text: cprShortForChart(d.cprLabel),
        sizePt: 11,
        colorHex: LABEL_COLOR,
      }),
    );
  });

  // Spend proportion bar along the very bottom — same per-campaign color as
  // its own donut ring above, so a segment is identifiable at a glance.
  const barY = H - 12;
  let barOffset = 0;
  chart.campaigns.forEach((d, ci) => {
    const pct = chart.totalAllSpend > 0 ? d.spend / chart.totalAllSpend : 1 / n;
    const segW = Math.max(Math.round(W * pct), 2);
    shapes.push(rectangle({ x: barOffset, y: barY, w: segW, h: 8, fillHex: campaignRingColor(ci) }));
    barOffset += segW;
  });

  return buildBlankSlideXml(shapes);
}
