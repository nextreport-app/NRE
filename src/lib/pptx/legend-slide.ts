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

/** Splits long metric names into the template's abbreviation + expansion pattern. */
function splitLegendTitle(term: string, slot: TemplateLegendSlot): { primary: string; secondary: string } {
  const upper = term.toUpperCase();
  if (slot.titleRuns.length < 2) {
    const words = upper.split(/\s+/);
    if (words.length >= 4 || upper.length > 18) {
      return { primary: words.map((w) => w[0]).join("").slice(0, 6), secondary: "" };
    }
    return { primary: upper, secondary: "" };
  }

  const paren = upper.match(/^(.+?)\s*\((.+)\)$/);
  if (paren) {
    return { primary: `${paren[1].trim()} `, secondary: `(${paren[2].trim()})` };
  }

  const words = upper.split(/\s+/);
  if (words.length >= 4 || upper.length > 22) {
    const acronym = words.map((w) => w[0]).join("").slice(0, 5);
    return { primary: `${acronym} `, secondary: `(${upper})` };
  }
  if (words.length === 3 && !/^\d+$/.test(words[2] ?? "")) {
    return { primary: `${words.slice(0, 2).join(" ")} `, secondary: `(${words[2]})` };
  }
  return { primary: upper, secondary: "" };
}

const LEGEND_DESC_OVERRIDES: Record<string, string> = {
  "The period during which Facebook's algorithm is learning the best ways to  achieve your campaign objective.":
    "When Meta's system is still learning the best way to deliver your ads.",
  "The actual number of clicks on links within the ad, leading to your chosen destination.":
    "Clicks on links in your ad that go to your website or app.",
};

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

    const { primary, secondary } = splitLegendTitle(entry.term, slot);
    xml = replaceLiteralText(xml, slot.titleRuns[0], primary);
    if (slot.titleRuns[1]) xml = replaceLiteralText(xml, slot.titleRuns[1], secondary);
    xml = replaceLiteralText(xml, slot.descText, entry.explanation);
  }

  for (const [original, replacement] of Object.entries(LEGEND_DESC_OVERRIDES)) {
    xml = replaceLiteralText(xml, original, replacement);
  }

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

  // Overflow guard: every card text box uses spAutoFit ("grow the shape to
  // fit the text"), which at the bumped-up 12pt floor lets long titles or
  // descriptions grow past their card background. Swap slide-wide for
  // normAutofit ("shrink the text to fit the shape") so nothing escapes its
  // card border — titles and descriptions alike.
  const beforeAutofitCount = (xml.match(/<a:spAutoFit\/>/g) || []).length;
  xml = xml.replace(/<a:spAutoFit\/>/g, "<a:normAutofit/>");
  console.log(
    `[legend-slide] converted ${beforeAutofitCount} description text box(es) from spAutoFit (grow shape, can overflow) to normAutofit (shrink text to fit)`,
  );

  // Round L — the slide's own static title ("METRIC ABBREVIATION GUIDE",
  // baked into the template, identical text across all 3 templates)
  // recolored to the same muted grey every other slide's own main heading
  // now uses. Size stays the template's native 28pt — unrequested, left
  // untouched.
  xml = forceRunStyle(xml, "METRIC ABBREVIATION GUIDE", { color: REPORT_HEADER_COLOR });

  return xml;
}
