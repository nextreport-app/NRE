/**
 * Metric Abbreviation Guide slide — Fix 2 reverts this back to the actual
 * template legend slide (templates/dark.pptx's ppt/slides/slide4.xml, and
 * the light/Google-Ads templates' own equivalents), instead of the flat,
 * from-scratch card grid a previous round introduced. That from-scratch
 * design didn't match the rest of the deck's look (icons, gradient circles,
 * card shadows) — this file no longer builds anything from scratch at all.
 *
 * The template's legend slide is one big group of 12 fixed card slots (3
 * columns x 4 rows), each slot itself a small group of 4 shapes: a
 * background card rect, an icon sub-group (gradient circle + glyph
 * picture), a title text shape (1 run, e.g. "REACH", or 2 runs, e.g. "CPL "
 * + "(COST PER LEAD)"), and a description text shape. parseTemplateLegendSlots
 * below discovers these 12 slots generically by walking the template's own
 * `<p:sp>` shapes in document order — it doesn't hardcode template text, so
 * it works unchanged for the light template (identical wording to dark) and
 * the Google Ads template (its own, different 12 entries — COST, CLICKS,
 * COST/CONV., etc. — reflecting Google's vocabulary instead of Meta's).
 *
 * buildLegendSlideXml then does a pure in-place retext, matching the same
 * spirit as fill-tags.ts's CARD_SLOT_TAGS retexting of the campaign
 * template's 7 fixed card slots: no shape is ever moved, cloned, or
 * removed. A used metric whose label already matches one of the 12 slots
 * (REACH, IMPRESSIONS, CTR, CPC, CPM, LEADS, CONVERSIONS, etc.) leaves that
 * slot completely untouched — original wording, description, and icon, all
 * unchanged. A used metric with no natural match (an objective-specific
 * label like "PURCHASES" or "ROAS" that the fixed 12 don't cover) borrows
 * the next still-unclaimed slot's title/description shapes, retexted in
 * place (same font, size, color, icon — only the words change). Slots that
 * end up needed by neither path keep showing the template's own original
 * entry — a reasonable, low-risk fallback given the fixed 12-slot grid
 * doesn't have room to expand, and "the actual metric" set for a mixed-
 * objective report often exceeds 12 anyway.
 */

import { enforceMinFontSize, forceRunStyle, replaceLiteralText } from "./ooxml";
import { REPORT_HEADER_COLOR } from "./fill-tags";

export interface LegendEntry {
  term: string;
  explanation: string;
}

interface TemplateLegendSlot {
  /** The title shape's own literal `<a:t>` run texts, in order — 1 for a single-word term (e.g. "REACH"), 2 for an abbreviation + expansion (e.g. "CPL " + "(COST PER LEAD)"). Used as both the locator and (for run 2) the "blank it out" target when this slot is overwritten. */
  titleRuns: string[];
  /** The description shape's own literal text — always a single run in every template inspected. */
  descText: string;
  /** Normalized (upper-cased, parenthetical-stripped) strings this slot's own title already represents — a used metric whose own normalized label equals any of these leaves the slot untouched. */
  matchKeys: string[];
}

function extractSpBlocks(xml: string): string[] {
  const blocks: string[] = [];
  const re = /<p:sp>[\s\S]*?<\/p:sp>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) blocks.push(m[0]);
  return blocks;
}

function extractRunTexts(block: string): string[] {
  const texts: string[] = [];
  const re = /<a:t>([^<]*)<\/a:t>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) if (m[1]) texts.push(m[1]);
  return texts;
}

/** Upper-cases, strips any "(...)" parenthetical, and collapses whitespace — puts both a slot's own term/expansion and an incoming metric's label into the same comparable form (e.g. "CTR (ALL)" and "CTR (CLICK-THROUGH RATE)" both normalize to "CTR"). */
function normalize(s: string): string {
  return s
    .toUpperCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// A handful of known wording gaps between slot-assignment.ts's own labels
// and the template's static copy — everything else is expected to line up
// via normalize() alone (both sides ultimately come from the same "Meta/
// Google ad metrics" vocabulary).
const TERM_ALIASES: Record<string, string> = {
  FREQUENCY: "AD FREQUENCY",
};

/**
 * Walks `templateXml`'s own `<p:sp>` shapes in document order and groups
 * them into the 12 card slots. The slide's own big heading ("METRIC
 * ABBREVIATION GUIDE") is always the first shape with any text at all
 * (every other text-bearing shape belongs to a card) — skipped, then every
 * remaining pair of text-bearing shapes is (title, description).
 * Background rects and icon gradient-circle shapes carry no text at all
 * and are naturally filtered out by the `texts.length > 0` check, so this
 * needs no knowledge of the group nesting depth.
 */
function parseTemplateLegendSlots(templateXml: string): TemplateLegendSlot[] {
  const textBlocks = extractSpBlocks(templateXml)
    .map((block) => extractRunTexts(block))
    .filter((texts) => texts.length > 0);

  const cardBlocks = textBlocks.slice(1); // drop the slide's own heading
  const slots: TemplateLegendSlot[] = [];

  for (let i = 0; i + 1 < cardBlocks.length; i += 2) {
    const titleRuns = cardBlocks[i];
    const descText = cardBlocks[i + 1].join(" ");
    const matchKeys = new Set<string>();
    for (const run of titleRuns) {
      const norm = normalize(run);
      if (norm) matchKeys.add(norm);
    }
    // Reverse-expand: a slot whose own term IS an alias's canonical form
    // (e.g. "AD FREQUENCY") should also accept an incoming metric using the
    // alias's shorter form ("FREQUENCY").
    for (const [shortForm, canonical] of Object.entries(TERM_ALIASES)) {
      if (matchKeys.has(canonical)) matchKeys.add(shortForm);
    }
    slots.push({ titleRuns, descText, matchKeys: [...matchKeys] });
  }

  return slots;
}

// Fix 8 (items 1, 2, 5) — an overlong dynamic metric name (e.g. an unusual
// CSV result_type auto-capitalized into a legend term, like "Cost per
// quote request submitted") wraps to a second line in the template's
// single-line, fixed-height title box (title boxes use noAutofit at
// authoring time), visibly overlapping the description text directly
// below it. Truncating at a word boundary within 28 characters — rather
// than a mid-word ellipsis cut — keeps the shortened name readable (e.g.
// "Cost per quote request submitted" -> "Cost per quote request"), and a
// still-long result (>25 chars, up to the 28-char cap) additionally gets
// a smaller 9pt title size so the single line fits its box comfortably.
const MAX_TERM_LENGTH = 28;
const SMALL_FONT_TERM_LENGTH = 25;
const SMALL_TERM_FONT_PT = 9;

function truncateTerm(term: string): string {
  if (term.length <= MAX_TERM_LENGTH) return term;
  const cut = term.slice(0, MAX_TERM_LENGTH);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim();
}

// Fix 8 (item 4) — grows each of the legend's 4 card rows taller so a
// long (2-3 line) description no longer needs to overflow its card to
// stay readable. Each row is its own <p:grpSp>; DrawingML scales a
// group's entire contents (background rect, icon, title, description —
// every child shape and its descendants) to fill however large the
// group's own placement <a:ext> is relative to its <a:chExt>, so growing
// just the row's own ext.cy — while leaving chExt.cy and every child
// shape's own numbers untouched — makes the whole card proportionally
// taller with no other edits needed. Each subsequent row's own off.y
// then shifts down by the same cumulative amount, preserving the
// original visual gap between rows. The growth (100,000 EMU, ~7.9pt,
// ~8.8% taller per row) is sized to fit inside the template's own
// existing slack below the last row — verified identical across all 3
// templates (dark/light/google): 496,644 EMU of margin to the slide's
// bottom edge, of which this uses 4 x 100,000 = 400,000, leaving 96,644
// EMU (~7.6pt) to spare. A no-op (silently skipped) against any template
// whose legend slide geometry doesn't match these exact baked-in values.
const ROW_GROWTH_EMU = 100000;
const LEGEND_ROW_Y = [1257589, 2581459, 3905329, 5229200];
const LEGEND_ROW_CX = [11261996, 11261996, 11274353, 11261996];
const LEGEND_ROW_OLD_CY = 1132156;
const LEGEND_OUTER_OLD_EXT = { cx: 11274353, cy: 5103767 };

function growLegendCardRows(xml: string): string {
  let out = xml;
  const newCy = LEGEND_ROW_OLD_CY + ROW_GROWTH_EMU;
  const newRowGap = LEGEND_ROW_Y[1] - LEGEND_ROW_Y[0] + ROW_GROWTH_EMU;
  for (let i = 0; i < LEGEND_ROW_Y.length; i++) {
    const oldY = LEGEND_ROW_Y[i];
    const cx = LEGEND_ROW_CX[i];
    const newY = LEGEND_ROW_Y[0] + i * newRowGap;
    const oldFrag = `<a:off x="460447" y="${oldY}"/><a:ext cx="${cx}" cy="${LEGEND_ROW_OLD_CY}"/><a:chOff x="460447" y="1257589"/><a:chExt cx="${cx}" cy="${LEGEND_ROW_OLD_CY}"/>`;
    const newFrag = `<a:off x="460447" y="${newY}"/><a:ext cx="${cx}" cy="${newCy}"/><a:chOff x="460447" y="1257589"/><a:chExt cx="${cx}" cy="${LEGEND_ROW_OLD_CY}"/>`;
    if (out.includes(oldFrag)) out = out.replace(oldFrag, newFrag);
  }
  // Cosmetic — keep the outer wrapper group's own stated bounding box
  // consistent with its (now taller) contents. Both ext and chExt move
  // together here (unlike the rows above) since this outer group isn't
  // meant to introduce its own extra scale on top of the rows'.
  const oldOuter = `<a:off x="460447" y="1257589"/><a:ext cx="${LEGEND_OUTER_OLD_EXT.cx}" cy="${LEGEND_OUTER_OLD_EXT.cy}"/><a:chOff x="460447" y="1257589"/><a:chExt cx="${LEGEND_OUTER_OLD_EXT.cx}" cy="${LEGEND_OUTER_OLD_EXT.cy}"/>`;
  const newOuterCy = LEGEND_OUTER_OLD_EXT.cy + LEGEND_ROW_Y.length * ROW_GROWTH_EMU;
  const newOuter = `<a:off x="460447" y="1257589"/><a:ext cx="${LEGEND_OUTER_OLD_EXT.cx}" cy="${newOuterCy}"/><a:chOff x="460447" y="1257589"/><a:chExt cx="${LEGEND_OUTER_OLD_EXT.cx}" cy="${newOuterCy}"/>`;
  if (out.includes(oldOuter)) out = out.replace(oldOuter, newOuter);
  return out;
}

export function buildLegendSlideXml(templateXml: string, entries: LegendEntry[]): string {
  const slots = parseTemplateLegendSlots(templateXml);
  const usedSlotIndex = new Set<number>();
  const unmatchedEntries: LegendEntry[] = [];

  // Pass 1 — leave any slot whose own template wording already matches a
  // used metric completely untouched (original text, description, icon).
  for (const entry of entries) {
    const normTerm = normalize(entry.term);
    const slotIndex = slots.findIndex((slot, i) => !usedSlotIndex.has(i) && slot.matchKeys.includes(normTerm));
    if (slotIndex === -1) {
      unmatchedEntries.push(entry);
    } else {
      usedSlotIndex.add(slotIndex);
    }
  }

  // Pass 2 — every used metric with no natural match borrows the next
  // still-unclaimed slot's shapes, retexted in place.
  let xml = templateXml;
  let cursor = 0;
  const smallFontTerms: string[] = [];
  for (const entry of unmatchedEntries) {
    while (cursor < slots.length && usedSlotIndex.has(cursor)) cursor++;
    if (cursor >= slots.length) break; // out of slots — the fixed 12-card grid is full
    const slot = slots[cursor];
    usedSlotIndex.add(cursor);
    cursor++;

    const truncatedTerm = truncateTerm(entry.term);
    const upperTerm = truncatedTerm.toUpperCase();
    if (truncatedTerm.length > SMALL_FONT_TERM_LENGTH) smallFontTerms.push(upperTerm);

    xml = replaceLiteralText(xml, slot.titleRuns[0], upperTerm);
    if (slot.titleRuns[1]) xml = replaceLiteralText(xml, slot.titleRuns[1], "");
    xml = replaceLiteralText(xml, slot.descText, entry.explanation);
  }

  // Item 4 — grow every card row taller, regardless of which/how many
  // slots got new text (even an untouched template-default card, like
  // LEARNING PHASE, benefits — its own long baked-in description is what
  // originally prompted this fix).
  xml = growLegendCardRows(xml);

  // Readability floor (product owner spec): every card's title/label text
  // at least 12pt, its description text underneath at least 11pt. The
  // template's own baked-in sizes are a title run at 14pt (already above
  // the floor — untouched), a smaller abbreviation-expansion run at 10.5pt
  // (e.g. "(COST PER LEAD)", part of the label), and a description run at
  // 10pt — both of the latter are below both floors, so a single blanket
  // 12pt pass (enforceMinFontSize, the same "readability pass" utility
  // fill-tags.ts already uses for the campaign template's card labels)
  // satisfies both requirements in one pass: it only ever RAISES a size
  // that's below the floor, never lowers one already at or above it.
  const before = [...xml.matchAll(/sz="(\d+)"/g)].map((m) => Number(m[1]));
  console.log(
    `[legend-slide] font sizes before 12pt floor: ${[...new Set(before)].sort((a, b) => a - b).map((s) => s / 100 + "pt").join(", ")}`,
  );
  xml = enforceMinFontSize(xml, 12);
  const after = [...xml.matchAll(/sz="(\d+)"/g)].map((m) => Number(m[1]));
  console.log(
    `[legend-slide] font sizes after 12pt floor: ${[...new Set(after)].sort((a, b) => a - b).map((s) => s / 100 + "pt").join(", ")}`,
  );

  // Overflow guard for the longer descriptions (e.g. "Learning Phase"'s):
  // every description text box in the template uses <a:spAutoFit/> ("grow
  // the shape to fit the text"), which made sense at the template's
  // original 10pt, but at the bumped-up 12pt floor a long description can
  // now grow past its card's fixed background rectangle — visibly
  // overflowing the card. Swapping it slide-wide for <a:normAutofit/>
  // ("shrink the TEXT to fit the shape" instead) only ever engages for a
  // description whose text genuinely doesn't fit its card at the 12pt
  // floor, leaving every other (shorter) description at the full 12pt
  // untouched.
  const beforeAutofitCount = (xml.match(/<a:spAutoFit\/>/g) || []).length;
  xml = xml.replace(/<a:spAutoFit\/>/g, "<a:normAutofit/>");
  console.log(
    `[legend-slide] converted ${beforeAutofitCount} description text box(es) from spAutoFit (grow shape, can overflow) to normAutofit (shrink text to fit)`,
  );

  // Item 3 — the title boxes use <a:noAutofit/> (fixed size, never
  // shrinks) rather than spAutoFit, so they need their own conversion:
  // every text box on this slide — title and description alike — now
  // uses normAutofit, so an overlong title that slips past the 28-char
  // truncation above still shrinks instead of overflowing.
  const beforeNoAutofitCount = (xml.match(/<a:noAutofit\/>/g) || []).length;
  xml = xml.replace(/<a:noAutofit\/>/g, "<a:normAutofit/>");
  console.log(
    `[legend-slide] converted ${beforeNoAutofitCount} title text box(es) from noAutofit (fixed size, can overflow) to normAutofit (shrink text to fit)`,
  );

  // Item 5 — a still-long truncated name (>25 chars, up to the 28-char
  // cap) gets a smaller 9pt title size so its single line fits its box
  // comfortably. Applied after the 12pt floor pass above so it isn't
  // immediately raised back up to the floor.
  for (const term of smallFontTerms) {
    xml = forceRunStyle(xml, term, { sizePt: SMALL_TERM_FONT_PT });
  }

  // Round L — the slide's own static title ("METRIC ABBREVIATION GUIDE",
  // baked into the template, identical text across all 3 templates)
  // recolored to the same muted grey every other slide's own main heading
  // now uses. Size stays the template's native 28pt — unrequested, left
  // untouched.
  xml = forceRunStyle(xml, "METRIC ABBREVIATION GUIDE", { color: REPORT_HEADER_COLOR });

  return xml;
}
