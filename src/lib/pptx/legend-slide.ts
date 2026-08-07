/**
 * Dynamic metric legend slide — built from scratch (same pattern as
 * chart-slide.ts), listing only the metrics that actually appear somewhere
 * in the report's automatically-assigned dynamicMetrics (see
 * slot-assignment.ts's buildMetaSlots/buildGoogleSlots), each as a small
 * card with the metric name and a one-line explanation from the metric
 * dictionary. Replaces the static, fixed 12-entry legend template slide
 * whenever the report has any dynamicMetrics at all — see render.ts, which
 * falls back to the original template.legend.xml unchanged only in the
 * (now unreachable in practice, since dynamicMetrics is always populated)
 * case where it doesn't.
 */

import type { TemplateBackgroundImage } from "./package";
import { backgroundImage, buildBlankSlideXml, resetShapeIdCounter, roundedCard, textBox } from "./shapes";

/** Relationship id the legend slide's own generated rels (see render.ts) registers the copied background picture under — mirrors chart-slide.ts's CHART_BG_REL_ID. */
export const LEGEND_BG_REL_ID = "rId2";

const HEADING_COLOR_DARK = "FFFFFF";

// Card styling — matches the other slides' own dynamic metric card look
// (see fill-tags.ts's CARD_SLOT_TAGS region: dark navy card, subtle
// blue-gray border, amber term color) — fixed regardless of which
// template is active, since the card itself is a deliberately dark card
// floating on whatever the page background is (the same way the light
// template's own fixed metric cards are still dark cards on a light page).
// Its own text (amber term, white explanation) therefore never swaps for
// the light template either — only the page-level title, which sits
// directly on the slide background, needs a light-template variant (same
// convention as chart-slide.ts's own HEADING_COLOR).
const CARD_FILL = "111f35";
const CARD_STROKE = "1e3a5f";
const TERM_COLOR = "f6ad55";
const TEXT_COLOR = "FFFFFF";

const HEADING_COLOR_LIGHT = "C17D0A";

export interface LegendEntry {
  term: string;
  explanation: string;
}

const W = 960;
const H = 540;
const TITLE_Y = 36;
const TITLE_H = 36;
const MARGIN = 48;
const COLS = 2;
const COL_GAP = 24;
const ROW_GAP = 12;
const CARD_PAD_X = 14;
const CARD_PAD_Y = 8;
const TERM_SIZE_PT = 11;
const EXPL_SIZE_PT = 10;
const TERM_H = 16;
const GAP_TERM_EXPL = 4;
const EXPL_H = 14;
// Fixed card height built from the fixed font sizes above (padding + term
// line + gap + explanation line) — text size is never shrunk below the
// product spec's stated minimum (10pt), so a report with many distinct
// metrics gets a taller grid (more rows), not smaller text.
const CARD_H = CARD_PAD_Y * 2 + TERM_H + GAP_TERM_EXPL + EXPL_H;

export function buildLegendSlideXml(
  entries: LegendEntry[],
  background: TemplateBackgroundImage,
  isLightTemplate = false,
): string {
  resetShapeIdCounter();

  const HEADING_COLOR = isLightTemplate ? HEADING_COLOR_LIGHT : HEADING_COLOR_DARK;

  const shapes: string[] = [];
  shapes.push(backgroundImage({ relId: LEGEND_BG_REL_ID, ...background }));

  shapes.push(
    textBox({
      x: 0,
      y: TITLE_Y,
      w: W,
      h: TITLE_H,
      text: "METRIC ABBREVIATION GUIDE",
      sizePt: 28,
      bold: true,
      colorHex: HEADING_COLOR,
    }),
  );

  const n = entries.length;
  if (n === 0) return buildBlankSlideXml(shapes);

  const contentTop = TITLE_Y + TITLE_H + 20;
  const colW = (W - MARGIN * 2 - COL_GAP * (COLS - 1)) / COLS;
  const rowsPerCol = Math.ceil(n / COLS);

  // Only the vertical gap between cards compresses when a large,
  // multi-objective report's used-metric set needs more rows than the
  // slide's default spacing allows — the card's own text sizes and padding
  // (and therefore its minimum readable height) never shrink.
  const availableH = H - contentTop - 20;
  const neededH = rowsPerCol * CARD_H + (rowsPerCol - 1) * ROW_GAP;
  const rowGap = neededH > availableH ? Math.max(4, (availableH - rowsPerCol * CARD_H) / Math.max(1, rowsPerCol - 1)) : ROW_GAP;

  entries.forEach((entry, i) => {
    const col = Math.floor(i / rowsPerCol);
    const row = i % rowsPerCol;
    const x = MARGIN + col * (colW + COL_GAP);
    const y = contentTop + row * (CARD_H + rowGap);

    shapes.push(roundedCard({ x, y, w: colW, h: CARD_H, fillHex: CARD_FILL, strokeHex: CARD_STROKE, radiusPt: 4 }));

    const textX = x + CARD_PAD_X;
    const textW = colW - CARD_PAD_X * 2;
    shapes.push(
      textBox({
        x: textX,
        y: y + CARD_PAD_Y,
        w: textW,
        h: TERM_H,
        text: entry.term.toUpperCase(),
        sizePt: TERM_SIZE_PT,
        bold: true,
        colorHex: TERM_COLOR,
      }),
    );
    shapes.push(
      textBox({
        x: textX,
        y: y + CARD_PAD_Y + TERM_H + GAP_TERM_EXPL,
        w: textW,
        h: EXPL_H,
        text: entry.explanation,
        sizePt: EXPL_SIZE_PT,
        colorHex: TEXT_COLOR,
      }),
    );
  });

  return buildBlankSlideXml(shapes);
}
