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
const BG_COLOR_DARK = "0d1b2e";
const LABEL_COLOR_DARK = "7ab0cc";
const TEXT_COLOR_DARK = "FFFFFF";

// This slide is built entirely from scratch (see buildBlankSlideXml) rather
// than filling a static template slide, so unlike the cover/campaign/table
// slides it gets none of the light-template's colors "for free" from a
// swapped theme.xml — every text/hole color it draws has to be picked
// explicitly per template here. The donut hole and the slide's own
// background both become light in the light template (hole: card
// background F1F5F9, slide bg: FFFFFF, both set via templates/
// meta-ads-light.pptx's theme swap) so one dark-navy text color reads fine
// against both, same as the light template's own metric-card value text.
const BG_COLOR_LIGHT = "F1F5F9";
const LABEL_COLOR_LIGHT = "64748B";
const TEXT_COLOR_LIGHT = "0D1B2E";

const INACTIVE_COLOR = "fbbf24"; // amber — "Paused"/"Inactive" indicator under a non-active campaign's name, unchanged across templates (same reasoning as the donut ring palette below: a decorative/status accent, not a background-polarity color)

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

export function buildChartSlideXml(
  chart: ChartSlideData,
  currencySymbol: string,
  background: TemplateBackgroundImage,
  isLightTemplate = false,
  platform: "META" | "GOOGLE" = "META",
): string {
  resetShapeIdCounter();

  const BG_COLOR = isLightTemplate ? BG_COLOR_LIGHT : BG_COLOR_DARK;
  const LABEL_COLOR = isLightTemplate ? LABEL_COLOR_LIGHT : LABEL_COLOR_DARK;
  const WHITE = isLightTemplate ? TEXT_COLOR_LIGHT : TEXT_COLOR_DARK;
  const spendLabel = platform === "GOOGLE" ? "COST" : "AD SPEND";

  const W = 960;
  const H = 540;
  const shapes: string[] = [];

  // A Monthly report covers a full calendar month, so "MTD" (month-to-date)
  // no longer applies — the title instead names the actual month, e.g.
  // "July Campaign Performance" (title case, not the all-caps MTD/WEEKLY
  // wording, matching the requested example literally).
  const chartTitle =
    chart.reportType === "MONTHLY" && chart.mtdMonthName
      ? `${chart.mtdMonthName} Campaign Performance`
      : (chart.periodLabel === "MTD" ? "MTD" : "WEEKLY") + " CAMPAIGN PERFORMANCE";

  shapes.push(backgroundImage({ relId: CHART_BG_REL_ID, ...background }));
  shapes.push(
    textBox({
      x: 0,
      y: 8,
      w: W,
      h: 34,
      text: chartTitle,
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

  // Fix 5 — CIRC_Y used to be a fixed 158pt, tuned only for the largest
  // circle size (CIRCLE_D capped at 200, i.e. n <= 3 campaigns). With more
  // campaigns, COL_W (and so CIRCLE_D) shrinks but CIRC_Y didn't, so the
  // whole per-campaign block — name, circle, results, CPR — shrank in place
  // and left a growing gap at the bottom, reading as "pushed to the top."
  // Centering it instead: the block spans from CIRC_Y-36 (the name label)
  // to CIRC_Y+CIRCLE_D+116 (the CPR sub-label's bottom) — see the per-
  // campaign shapes below for exactly where those offsets come from — so
  // its total height is CIRCLE_D+152, and CIRC_Y is chosen to center that
  // in the space between the header ("Total ... Spend" line, ending at
  // y=68) and the spend-proportion bar at the very bottom (y=H-12=528).
  const HEADER_BOTTOM = 70;
  const BOTTOM_LIMIT = 520;
  const BLOCK_HEIGHT = CIRCLE_D + 152;
  const availableHeight = BOTTOM_LIMIT - HEADER_BOTTOM;
  const CIRC_Y = HEADER_BOTTOM + Math.max(0, (availableHeight - BLOCK_HEIGHT) / 2) + 36;

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
      textBox({ x: textBoxX, y: centerY + 4, w: textBoxW, h: 12, text: spendLabel, sizePt: 11, colorHex: LABEL_COLOR }),
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
