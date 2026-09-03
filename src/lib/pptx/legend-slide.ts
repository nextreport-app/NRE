/**
 * Metric Abbreviation Guide slide — in-place retext of the template's 12 fixed card slots.
 */

import { enforceMinFontSize, forceRunStyle, replaceLiteralText, setShapeNormAutofit } from "./ooxml";
import { REPORT_HEADER_COLOR, REPORT_HEADER_SIZE_PT } from "./fill-tags";

export interface LegendEntry {
  term: string;
  explanation: string;
}

interface TemplateLegendSlot {
  titleRuns: string[];
  descText: string;
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
  const maxSecondaryLen = 18;

  function trimSecondary(text: string): string {
    if (text.length <= maxSecondaryLen) return text;
    return `${text.slice(0, maxSecondaryLen - 1)}…`;
  }

  if (slot.titleRuns.length < 2) {
    const words = upper.split(/\s+/);
    if (words.length >= 4 || upper.length > 16) {
      return { primary: words.map((w) => w[0]).join("").slice(0, 6), secondary: "" };
    }
    return { primary: upper.length > 20 ? `${upper.slice(0, 19)}…` : upper, secondary: "" };
  }

  const paren = upper.match(/^(.+?)\s*\((.+)\)$/);
  if (paren) {
    const expansion = `(${paren[2].trim()})`;
    return { primary: `${paren[1].trim().slice(0, 14)} `, secondary: trimSecondary(expansion) };
  }

  const words = upper.split(/\s+/);
  if (words.length >= 4 || upper.length > 18) {
    const acronym = words.map((w) => w[0]).join("").slice(0, 5);
    return { primary: `${acronym} `, secondary: trimSecondary(`(${upper.slice(0, 16)}…)`) };
  }
  if (words.length === 3 && !/^\d+$/.test(words[2] ?? "")) {
    return { primary: `${words.slice(0, 2).join(" ")} `, secondary: trimSecondary(`(${words[2]})`) };
  }
  return { primary: upper.length > 16 ? `${upper.slice(0, 15)}…` : upper, secondary: "" };
}

const LEGEND_DESC_OVERRIDES: Record<string, string> = {
  "The period during which Facebook's algorithm is learning the best ways to  achieve your campaign objective.":
    "When Meta's system is still learning the best way to deliver your ads.",
  "The actual number of clicks on links within the ad, leading to your chosen destination.":
    "Clicks on links in your ad that go to your website or app.",
};

const TERM_ALIASES: Record<string, string> = {
  FREQUENCY: "AD FREQUENCY",
};

function parseTemplateLegendSlots(templateXml: string): TemplateLegendSlot[] {
  const textBlocks = extractSpBlocks(templateXml)
    .map((block) => extractRunTexts(block))
    .filter((texts) => texts.length > 0);

  const cardBlocks = textBlocks.slice(1);
  const slots: TemplateLegendSlot[] = [];

  for (let i = 0; i + 1 < cardBlocks.length; i += 2) {
    const titleRuns = cardBlocks[i];
    const descText = cardBlocks[i + 1].join(" ");
    const matchKeys = new Set<string>();
    for (const run of titleRuns) {
      const norm = normalize(run);
      if (norm) matchKeys.add(norm);
    }
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

  for (const entry of entries) {
    const normTerm = normalize(entry.term);
    const slotIndex = slots.findIndex((slot, i) => !usedSlotIndex.has(i) && slot.matchKeys.includes(normTerm));
    if (slotIndex === -1) {
      unmatchedEntries.push(entry);
    } else {
      usedSlotIndex.add(slotIndex);
    }
  }

  let xml = templateXml;
  let cursor = 0;
  for (const entry of unmatchedEntries) {
    while (cursor < slots.length && usedSlotIndex.has(cursor)) cursor++;
    if (cursor >= slots.length) break;
    const slot = slots[cursor];
    usedSlotIndex.add(cursor);
    cursor++;

    const { primary, secondary } = splitLegendTitle(entry.term, slot);
    xml = replaceLiteralText(xml, slot.titleRuns[0], primary);
    if (slot.titleRuns[1]) {
      xml = replaceLiteralText(xml, slot.titleRuns[1], secondary || " ");
    }
    const explanation =
      entry.explanation.length > 90 ? `${entry.explanation.slice(0, 87).trimEnd()}…` : entry.explanation;
    xml = replaceLiteralText(xml, slot.descText, explanation);
    xml = setShapeNormAutofit(xml, slot.titleRuns[0]);
    xml = setShapeNormAutofit(xml, explanation);
  }

  for (const [original, replacement] of Object.entries(LEGEND_DESC_OVERRIDES)) {
    xml = replaceLiteralText(xml, original, replacement);
  }

  // Description floor only — title shapes keep template sizing so headings
  // don't grow into the description area below.
  for (const slot of slots) {
    xml = setShapeNormAutofit(xml, slot.descText);
  }
  xml = enforceMinFontSize(xml, 11);

  xml = forceRunStyle(xml, "METRIC ABBREVIATION GUIDE", {
    bold: true,
    sizePt: REPORT_HEADER_SIZE_PT,
    color: REPORT_HEADER_COLOR,
  });

  return xml;
}
