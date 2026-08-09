/**
 * Rough single-line text-width estimation and font-size auto-shrink, used
 * where a name of unpredictable length (account name, campaign name) must
 * always render on one line rather than wrap. PPTX shapes are each
 * independently, absolutely positioned — a text box that wraps to a second
 * line doesn't push sibling shapes down, it visually overlaps/crowds them.
 *
 * There's no real font metrics available at render time (no bundled font
 * files, no DOM/canvas), so this uses a calibrated average character-width
 * table for a geometric sans-serif (Poppins and similar), deliberately
 * biased slightly wide — a safe overestimate — so a size this picks is very
 * unlikely to still wrap once actually rendered.
 */

const NARROW_RATIO = 0.3; // i l j f t I . , ' ! : ; | ( )
const WIDE_RATIO = 0.95; // m w M W @
const UPPER_RATIO = 0.72; // default uppercase
const DIGIT_RATIO = 0.58;
const SPACE_RATIO = 0.3;
const DEFAULT_RATIO = 0.56; // lowercase and everything else

const NARROW_CHARS = "iljftI.,'!:;|()[]";
const WIDE_CHARS = "mwMW@";

// Calibrated empirically (rendered .pptx -> LibreOffice -> pixel-measured),
// not just guessed: a naive 1.0x version of this table under-predicted a
// real wrap by a full candidate step (predicted 18pt would fit a 42-char
// name in the widened account-name box; actually only 16pt did). Biasing
// every ratio wide by 20% closes that gap with room to spare, and errs
// toward shrinking a little more than strictly necessary rather than risk
// the wrap this whole mechanism exists to prevent.
const SAFETY_FACTOR = 1.2;

function charWidthRatio(ch: string): number {
  if (NARROW_CHARS.includes(ch)) return NARROW_RATIO;
  if (WIDE_CHARS.includes(ch)) return WIDE_RATIO;
  if (ch >= "0" && ch <= "9") return DIGIT_RATIO;
  if (ch === " ") return SPACE_RATIO;
  if (ch >= "A" && ch <= "Z") return UPPER_RATIO;
  return DEFAULT_RATIO;
}

/** Approximate rendered single-line width of `text` set at `sizePt`, in points. */
export function estimateTextWidthPt(text: string, sizePt: number): number {
  let ratio = 0;
  for (const ch of text) ratio += charWidthRatio(ch);
  return ratio * sizePt * SAFETY_FACTOR;
}

/**
 * Picks the largest size from `candidateSizesPt` (checked in the given
 * order — largest/most-preferred first) whose estimated width fits within
 * `maxWidthPt`. Falls back to the last (smallest) candidate if none fit —
 * the caller's shape should also set wrap="none" as a safety net for that
 * remaining edge case, so an unusually long name overflows horizontally
 * rather than wrapping to a crowding second line.
 */
export function fitFontSizePt(text: string, maxWidthPt: number, candidateSizesPt: number[]): number {
  for (const sizePt of candidateSizesPt) {
    if (estimateTextWidthPt(text, sizePt) <= maxWidthPt) return sizePt;
  }
  return candidateSizesPt[candidateSizesPt.length - 1];
}

export function emuToPt(emu: number): number {
  return emu / 12700;
}

/**
 * Metric card label overflow fix (campaign/ad-set slide cards) — unlike
 * the width-estimation approach above, the spec here is exact fixed
 * character-count bands, not "measure and find whatever fits," so this is
 * plain length-based arithmetic. CARD_LABEL_BASE_SIZE_PT is 12pt because
 * that's the *effective* current label size: the template's own stored
 * card-label runs are 11.5pt, but fill-tags.ts's readability-pass floor
 * (enforceMinFontSize) already bumps every one of them up to 12pt today —
 * "current size" for a short label means what's actually on screen now.
 */
const CARD_LABEL_BASE_SIZE_PT = 12;
const CARD_LABEL_TRUNCATE_AT = 35;

export interface CardLabelFit {
  /** Possibly-truncated label text. */
  text: string;
  /** Font size to render `text` at, in points. */
  sizePt: number;
}

/**
 * Shrinks a metric card label's font size by a fixed amount based on its
 * (pre-truncation) character-count band, and truncates with a "..." past
 * CARD_LABEL_TRUNCATE_AT characters — even the largest reduction can't
 * reliably keep a label that long on one line in the card's fixed-width
 * label box.
 */
export function fitCardLabel(label: string): CardLabelFit {
  const len = label.length;
  const reductionPt = len <= 18 ? 0 : len <= 24 ? 1.5 : len <= 30 ? 2.5 : 3.5;
  const text = len > CARD_LABEL_TRUNCATE_AT ? label.slice(0, CARD_LABEL_TRUNCATE_AT) + "..." : label;
  return { text, sizePt: CARD_LABEL_BASE_SIZE_PT - reductionPt };
}
