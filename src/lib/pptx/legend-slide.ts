/**
 * Dynamic metric legend slide — built from scratch (same pattern as
 * chart-slide.ts) listing only the metrics that actually appear somewhere
 * in the report's dynamicMetrics (the Metric Preview wizard step's
 * selection), each as a bold term + one-line explanation from the metric
 * dictionary. Replaces the static, fixed 12-entry legend template slide
 * only when the report actually used the dynamic metric dictionary system
 * — see render.ts, which falls back to the original template.legend.xml
 * unchanged whenever no slide has any dynamicMetrics at all.
 */

import type { TemplateBackgroundImage } from "./package";
import { backgroundImage, buildBlankSlideXml, resetShapeIdCounter, textBox } from "./shapes";

/** Relationship id the legend slide's own generated rels (see render.ts) registers the copied background picture under — mirrors chart-slide.ts's CHART_BG_REL_ID. */
export const LEGEND_BG_REL_ID = "rId2";

const BG_COLOR_DARK = "0d1b2e";
const TEXT_COLOR_DARK = "FFFFFF";
const LABEL_COLOR_DARK = "7ab0cc";

// Same reasoning as chart-slide.ts's own light/dark color pair — this slide
// draws every color itself (no template shape to inherit theme.xml colors
// from), so it needs its own light-template variant.
const TEXT_COLOR_LIGHT = "0D1B2E";
const LABEL_COLOR_LIGHT = "1E3A5F";
const HEADING_COLOR_LIGHT = "C17D0A";

export interface LegendEntry {
  term: string;
  explanation: string;
}

export function buildLegendSlideXml(
  entries: LegendEntry[],
  background: TemplateBackgroundImage,
  isLightTemplate = false,
): string {
  resetShapeIdCounter();

  const TEXT_COLOR = isLightTemplate ? TEXT_COLOR_LIGHT : TEXT_COLOR_DARK;
  const LABEL_COLOR = isLightTemplate ? LABEL_COLOR_LIGHT : LABEL_COLOR_DARK;
  const HEADING_COLOR = isLightTemplate ? HEADING_COLOR_LIGHT : TEXT_COLOR_DARK;

  const W = 960;
  const H = 540;
  const shapes: string[] = [];
  shapes.push(backgroundImage({ relId: LEGEND_BG_REL_ID, ...background }));

  const TITLE_Y = 40;
  const TITLE_H = 40;
  shapes.push(
    textBox({ x: 0, y: TITLE_Y, w: W, h: TITLE_H, text: "METRIC GUIDE", sizePt: 28, bold: true, colorHex: HEADING_COLOR }),
  );

  const n = entries.length;
  if (n === 0) return buildBlankSlideXml(shapes);

  const MARGIN = 60;
  const COL_GAP = 40;
  const contentTop = TITLE_Y + TITLE_H + 20;
  const BOTTOM_MARGIN = 20;
  const availableH = H - contentTop - BOTTOM_MARGIN;

  // Fix 2 removed the old 8-metric selection cap, so a report's used-metric
  // set (and therefore this legend) is no longer bounded at a size the
  // original fixed 2-column/66pt-row layout was sized for — a 16-entry
  // legend needed 8 rows per column at that row height and silently ran
  // ~90pt off the bottom of the slide (caught empirically, not
  // hypothetically). Column count now grows with entry count, and row
  // height/font sizes scale down (with a legible floor) so any n fits
  // within the slide instead of overflowing it.
  const cols = n > 12 ? 3 : n > 4 ? 2 : 1;
  const colW = (W - MARGIN * 2 - COL_GAP * (cols - 1)) / cols;
  const rowsPerCol = Math.ceil(n / cols);

  const IDEAL_ROW_H = 66;
  const MIN_ROW_H = 40;
  const rowH = Math.min(IDEAL_ROW_H, Math.max(MIN_ROW_H, availableH / rowsPerCol));
  const shrink = rowH / IDEAL_ROW_H;

  const termSizePt = Math.max(10, Math.round(14 * shrink));
  const explSizePt = Math.max(8, Math.round(11 * shrink));
  const TERM_H = Math.round(18 * shrink);
  const GAP_TERM_EXPL = 2;
  const EXPL_H = rowH - TERM_H - GAP_TERM_EXPL - 4;

  entries.forEach((entry, i) => {
    const col = Math.floor(i / rowsPerCol);
    const row = i % rowsPerCol;
    const x = MARGIN + col * (colW + COL_GAP);
    const y = contentTop + row * rowH;

    shapes.push(
      textBox({ x, y, w: colW, h: TERM_H, text: entry.term, sizePt: termSizePt, bold: true, colorHex: TEXT_COLOR }),
    );
    shapes.push(
      textBox({
        x,
        y: y + TERM_H + GAP_TERM_EXPL,
        w: colW,
        h: EXPL_H,
        text: entry.explanation,
        sizePt: explSizePt,
        colorHex: LABEL_COLOR,
      }),
    );
  });

  return buildBlankSlideXml(shapes);
}
