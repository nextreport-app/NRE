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
import type { ChartCampaignData, ChartSlideData } from "../nre/report-data";
import type { TemplateBackgroundImage } from "./package";
import { REPORT_HEADER_COLOR } from "./fill-tags";
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
// background both become light in the light template (hole/card background:
// FFFFFF, slide bg: FDF6EC, both set via templates/meta-ads-light.pptx's
// theme swap) so one dark-navy text color reads fine against both, same as
// the light template's own metric-card value text. The chart title itself
// (see HEADING_COLOR below, round L) is the one literal muted-grey hex
// shared with every other slide's main heading, so it doesn't need its own
// per-template light/dark variant here.
const BG_COLOR_LIGHT = "FFFFFF";
// Mid navy, matching the pptx template's own metric-card labels
// (gen_light_template.py's LABEL_TEXT_COLOR) — readability fix v2: the
// original muted slate grey (#64748b) was too low-contrast against the
// warm background per user feedback.
const LABEL_COLOR_LIGHT = "1E3A5F";
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

// Fix 6 — a campaign with zero spend this month (no MTD rows at all, or
// present with every value at 0) reads as an empty/grey donut instead of
// one of the real campaign colors, so a genuine $0 month is visually
// distinct from real data at a glance. Grey is otherwise reserved
// exclusively for the donut's own inner hole (see BG_COLOR_DARK/LIGHT's own
// doc comment above) and never used as a real campaign's ring color, so
// reusing it here for "no spend" carries that same "nothing here" meaning.
const EMPTY_RING_COLOR = "9ca3af";

/** Exported for share-report.ts, which needs the exact same per-campaign color the PPT chart slide's donut ring uses (real palette color for a campaign with real spend, the shared grey for a genuine $0 month) so the public share page's bar chart matches the deck. */
export function ringColorForCampaign(d: ChartCampaignData, index: number): string {
  return d.spend > 0 ? campaignRingColor(index) : EMPTY_RING_COLOR;
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
  // Round L — the same muted grey every other slide's own main heading now
  // uses (was TEXT_COLOR_DARK/HEADING_COLOR_LIGHT — plain white on dark,
  // amber-brown on light), uniform across both templates since the deck's
  // other unified headings (report-type header, cover, Combined Total,
  // Metric Guide) all use this one literal hex regardless of template.
  const HEADING_COLOR = REPORT_HEADER_COLOR;
  const spendLabel = platform === "GOOGLE" ? "COST" : "AD SPEND";

  const W = 960;
  const H = 540;
  const shapes: string[] = [];

  // Whenever the actual month name is known, the title names it directly
  // ("July Campaign Performance") instead of the all-caps MTD/WEEKLY
  // jargon — clients don't recognize "MTD," but every client understands a
  // month name. Applies to both Weekly and Monthly reports now (previously
  // only Monthly); the all-caps text only remains as a fallback for the
  // rare case a month name isn't available at all (e.g. a zero-data
  // report).
  //
  // Fix 2 — the title and its clarifying date-range sub-line used to be two
  // separate stacked text boxes with no gap between them, which read as
  // cluttered. Folded into one combined line instead ("August Campaign
  // Performance: August 1 - August 10, 2026" / "...: Full Month 2026").
  // hasSubLabel/periodSubLabel is empty for a paused/zero-data report — the
  // title then falls back to the bare "[Month] Campaign Performance" (or the
  // all-caps fallback) with no ": ..." suffix, same as before this line
  // ever existed.
  const hasSubLabel = chart.periodSubLabel.length > 0;
  const baseTitle = chart.mtdMonthName
    ? `${chart.mtdMonthName} Campaign Performance`
    : (chart.periodLabel === "MTD" ? "MTD" : "WEEKLY") + " CAMPAIGN PERFORMANCE";
  const chartTitle = hasSubLabel ? `${baseTitle}: ${chart.periodSubLabel}` : baseTitle;
  // Fix 1 (this round) — always 28pt, matching every other slide's own
  // heading size (cover/campaign/table/legend all use 28pt) — this used to
  // drop to 16pt whenever a date-range sub-line was present (i.e. almost
  // every real report), which read as visibly smaller than the rest of the
  // deck instead of uniform.
  const TITLE_SIZE_PT = 28;

  shapes.push(backgroundImage({ relId: CHART_BG_REL_ID, ...background }));

  const activeCount = chart.activeCampaignCount;
  // Fix 4 — clients don't recognize "MTD" any better here than in the
  // title above; spell it out instead of abbreviating.
  const spendPeriodLabel = chart.periodLabel === "MTD" ? "Month to Date" : chart.periodLabel;
  const subtitleText =
    `Total ${spendPeriodLabel} Spend:  ` +
    currencySymbol +
    Math.round(chart.totalAllSpend).toLocaleString("en-US") +
    `     ·     ${activeCount} Active Campaign${activeCount === 1 ? "" : "s"}`;

  const TITLE_H = 34;
  // Was 2pt — read as cramped against the heading directly above it (the
  // "Total Month to Date Spend: ... · N Active Campaigns" line). Bumped by
  // 12pt.
  const GAP_TITLE_SUBTITLE = 14;
  const SUBTITLE_H = 24;

  const n = chart.campaigns.length;
  if (n === 0) {
    // No per-campaign block or spend bar to include — center just the
    // title+subtitle as their own (much smaller) content block.
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

  const MARGIN = 20;
  const COL_W = Math.floor((W - MARGIN * (n + 1)) / n);
  const CIRCLE_D = Math.min(COL_W - 20, 200);
  const INNER_D = Math.round(CIRCLE_D * 0.7);

  // Horizontal centering — COL_W's floor() division can leave a few points
  // of width unused across n columns; without correction that leftover
  // always lands on the right (colX starts flush at x=MARGIN), so the row
  // of circles reads as off-center. rowXOffset distributes it evenly on
  // both sides instead.
  const totalRowWidth = MARGIN * (n + 1) + COL_W * n;
  const rowXOffset = Math.floor((W - totalRowWidth) / 2);

  // Vertical centering (Fix 2 follow-up) — this has been flagged before:
  // the previous approach (see git blame, "Fix 5") only centered the
  // per-campaign block within the leftover space between a fixed-position
  // header (title+subtitle pinned to the top, ending at y=68) and a
  // fixed-position spend bar (pinned to the bottom, at y=H-12=528). That
  // under-counts the title/subtitle's own height as part of "the content,"
  // so the overall composition — title+subtitle+circles+bar all together —
  // still read as top-heavy: confirmed by rendering through LibreOffice and
  // measuring the title's y-offset (8pt from the top) against the bar's gap
  // to the bottom edge (4pt) — nowhere near equal.
  //
  // Fixed here by treating the ENTIRE visible block (title, subtitle, the
  // per-campaign circles/labels, and the spend bar) as one unit, measuring
  // its total height, and centering that whole unit between the slide's
  // top and bottom edges — so the empty margin above the title exactly
  // equals the empty margin below the bar. The per-campaign block's own
  // height (CIRCLE_D+152, from the name label above the circle to the CPR
  // sub-label below it — see the per-campaign shapes below for exactly
  // where those offsets come from) is unchanged from before.
  const GAP_SUBTITLE_BLOCK = 20;
  const BLOCK_H = CIRCLE_D + 152;
  const GAP_BLOCK_BAR = 20;
  const BAR_H = 8;

  const totalContentHeight = TITLE_H + GAP_TITLE_SUBTITLE + SUBTITLE_H + GAP_SUBTITLE_BLOCK + BLOCK_H + GAP_BLOCK_BAR + BAR_H;
  const contentTop = Math.max(0, (H - totalContentHeight) / 2);

  const titleY = contentTop;
  const subtitleY = titleY + TITLE_H + GAP_TITLE_SUBTITLE;
  const blockTopY = subtitleY + SUBTITLE_H + GAP_SUBTITLE_BLOCK; // matches "CIRC_Y - 36" below (the name label's own top)
  const CIRC_Y = blockTopY + 36;
  const barY = blockTopY + BLOCK_H + GAP_BLOCK_BAR;

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
      sizePt: 18,
      bold: false,
      colorHex: WHITE,
    }),
  );

  chart.campaigns.forEach((d, ci) => {
    const col = ringColorForCampaign(d, ci);
    const colX = rowXOffset + MARGIN + ci * (COL_W + MARGIN);
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

  // Spend proportion bar — same per-campaign color as its own donut ring
  // above, so a segment is identifiable at a glance. Its own y (barY) is
  // now computed above as part of the whole content block's vertical
  // centering, rather than pinned to the slide's bottom edge.
  let barOffset = 0;
  chart.campaigns.forEach((d, ci) => {
    const pct = chart.totalAllSpend > 0 ? d.spend / chart.totalAllSpend : 1 / n;
    const segW = Math.max(Math.round(W * pct), 2);
    shapes.push(rectangle({ x: barOffset, y: barY, w: segW, h: BAR_H, fillHex: ringColorForCampaign(d, ci) }));
    barOffset += segW;
  });

  return buildBlankSlideXml(shapes);
}
