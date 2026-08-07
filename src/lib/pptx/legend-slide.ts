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

import { replaceLiteralText } from "./ooxml";

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
  for (const entry of unmatchedEntries) {
    while (cursor < slots.length && usedSlotIndex.has(cursor)) cursor++;
    if (cursor >= slots.length) break; // out of slots — the fixed 12-card grid is full
    const slot = slots[cursor];
    usedSlotIndex.add(cursor);
    cursor++;

    xml = replaceLiteralText(xml, slot.titleRuns[0], entry.term.toUpperCase());
    if (slot.titleRuns[1]) xml = replaceLiteralText(xml, slot.titleRuns[1], "");
    xml = replaceLiteralText(xml, slot.descText, entry.explanation);
  }

  return xml;
}
