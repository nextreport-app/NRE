import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeAll } from "vitest";
import { buildLegendSlideXml, type LegendEntry } from "../legend-slide";
import { loadTemplate, type LoadedTemplate } from "../package";

const DARK_TEMPLATE_PATH = path.resolve(__dirname, "../../../../templates/dark.pptx");
const GOOGLE_TEMPLATE_PATH = path.resolve(__dirname, "../../../../templates/google-ads-dark.pptx");
const LIGHT_TEMPLATE_PATH = path.resolve(__dirname, "../../../../templates/meta-ads-light.pptx");

let darkTemplate: LoadedTemplate;
let googleTemplate: LoadedTemplate;
let lightTemplate: LoadedTemplate;

beforeAll(async () => {
  darkTemplate = await loadTemplate(fs.readFileSync(DARK_TEMPLATE_PATH));
  googleTemplate = await loadTemplate(fs.readFileSync(GOOGLE_TEMPLATE_PATH));
  lightTemplate = await loadTemplate(fs.readFileSync(LIGHT_TEMPLATE_PATH));
});

function entry(overrides: Partial<LegendEntry> = {}): LegendEntry {
  return { term: "PURCHASES", explanation: "Number of purchases attributed to your ad", ...overrides };
}

describe("buildLegendSlideXml — Fix 2: reuses the real template legend slide, no from-scratch design", () => {
  it("leaves all text content unchanged when no entries are passed — except shortened descriptions that prevent card overflow", () => {
    const xml = buildLegendSlideXml(darkTemplate.legend.xml, []);
    const origTexts = [...darkTemplate.legend.xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]);
    const newTexts = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]);
    const overflowSafeReplacements = new Set([
      "When Meta's system is still learning the best way to deliver your ads.",
      "Clicks on links in your ad that go to your website or app.",
    ]);
    for (let i = 0; i < origTexts.length; i++) {
      if (overflowSafeReplacements.has(newTexts[i] ?? "")) continue;
      expect(newTexts[i]).toBe(origTexts[i]);
    }
    // Shape count, structure, and everything else non-font-size is untouched.
    expect((xml.match(/<p:sp>/g) || []).length).toBe((darkTemplate.legend.xml.match(/<p:sp>/g) || []).length);
  });

  it("round L: recolors the slide's own static 'METRIC ABBREVIATION GUIDE' title to the same muted grey every other slide's own main heading uses, across all 3 templates", () => {
    for (const tpl of [darkTemplate, googleTemplate, lightTemplate]) {
      const xml = buildLegendSlideXml(tpl.legend.xml, []);
      const titleRun = /<a:r>(?:(?!<\/a:r>)[\s\S])*?METRIC ABBREVIATION GUIDE[\s\S]*?<\/a:r>/.exec(xml)![0];
      expect(titleRun).toContain('<a:srgbClr val="94a3b8"/>');
    }
  });

  it("readability floor: description runs at least 11pt; title runs keep template sizing", () => {
    const origSizes = [...darkTemplate.legend.xml.matchAll(/sz="(\d+)"/g)].map((m) => Number(m[1]));
    expect(origSizes).toContain(1400);
    expect(origSizes).toContain(1050);
    expect(origSizes).toContain(1000);

    const xml = buildLegendSlideXml(darkTemplate.legend.xml, []);
    const newSizes = [...xml.matchAll(/sz="(\d+)"/g)].map((m) => Number(m[1]));
    expect(Math.min(...newSizes)).toBeGreaterThanOrEqual(1100);
    expect(newSizes).toContain(1400);
  });

  it("applies the same readability floor across all 3 templates (dark, light, Google)", () => {
    for (const tpl of [darkTemplate, lightTemplate, googleTemplate]) {
      const xml = buildLegendSlideXml(tpl.legend.xml, []);
      const sizes = [...xml.matchAll(/sz="(\d+)"/g)].map((m) => Number(m[1]));
      expect(Math.min(...sizes)).toBeGreaterThanOrEqual(1100);
    }
  });

  it("keeps the original 12-card template structure and styling intact — no roundedCard/flat design shapes added", () => {
    const xml = buildLegendSlideXml(darkTemplate.legend.xml, [entry()]);
    // Same shape count as the untouched template — nothing added or removed.
    const origShapeCount = (darkTemplate.legend.xml.match(/<p:sp>/g) || []).length;
    const newShapeCount = (xml.match(/<p:sp>/g) || []).length;
    expect(newShapeCount).toBe(origShapeCount);
    expect(xml).toContain("METRIC ABBREVIATION GUIDE");
    // The template's own gradient-circle icon shapes and shadow effects survive untouched.
    expect(xml).toContain("gradFill");
    expect(xml).toContain("outerShdw");
  });

  it("leaves a slot whose template wording already matches a used metric completely untouched", () => {
    const xml = buildLegendSlideXml(darkTemplate.legend.xml, [
      entry({ term: "REACH", explanation: "Some other explanation entirely" }),
    ]);
    // The template's own original REACH copy survives verbatim — our own
    // (different) explanation text for the same term is never inserted.
    expect(xml).toContain("The total number of unique users who saw your ad.");
    expect(xml).not.toContain("Some other explanation entirely");
  });

  it("matches case-insensitively and ignores a parenthetical suffix (CTR (ALL) matches the template's CTR slot)", () => {
    const xml = buildLegendSlideXml(darkTemplate.legend.xml, [entry({ term: "CTR (ALL)" })]);
    // Untouched — the template's own CTR card (with its "(CLICK-THROUGH RATE)" expansion) stays as-is.
    expect(xml).toContain("(CLICK-THROUGH RATE)");
  });

  it("applies the FREQUENCY -> AD FREQUENCY alias", () => {
    const xml = buildLegendSlideXml(darkTemplate.legend.xml, [
      entry({ term: "FREQUENCY", explanation: "Should never appear — AD FREQUENCY slot already covers this" }),
    ]);
    expect(xml).toContain("AD FREQUENCY");
    expect(xml).toContain("The average number of times each person in your reach saw your ad.");
    expect(xml).not.toContain("Should never appear");
  });

  it("retexts the next unclaimed slot, in place, for a metric with no natural template match", () => {
    const xml = buildLegendSlideXml(darkTemplate.legend.xml, [entry({ term: "PURCHASES", explanation: "Purchases explanation text" })]);
    expect(xml).toContain("PURCHASES");
    expect(xml).toContain("Purchases explanation text");
    // The borrowed slot's own original wording no longer appears — it was replaced, not duplicated.
    expect(xml).not.toContain("REACH");
  });

  it("blanks the borrowed slot's second title run instead of leaving stale abbreviation text (e.g. borrowing the CPL slot no longer shows '(COST PER LEAD)')", () => {
    // 12 distinct unmatched entries forces every slot (including the 2-run
    // ones like CPL) to be borrowed.
    const manyEntries = Array.from({ length: 12 }, (_, i) => entry({ term: `CUSTOM METRIC ${i}`, explanation: `Explanation ${i}` }));
    const xml = buildLegendSlideXml(darkTemplate.legend.xml, manyEntries);
    expect(xml).not.toContain("(COST PER LEAD)");
    expect(xml).not.toContain("(COST PER RESULT)");
    expect(xml).not.toContain("(COST PER CLICK)");
    expect(xml).not.toContain("(CLICK-THROUGH RATE)");
    expect(xml).not.toContain("(COST PER MILLE)");
    for (let i = 0; i < 12; i++) {
      expect(xml).toContain(`CUSTOM METRIC ${i}`);
      expect(xml).toContain(`Explanation ${i}`);
    }
  });

  it("drops overflow entries beyond the template's fixed 12 slots instead of throwing", () => {
    const manyEntries = Array.from({ length: 20 }, (_, i) => entry({ term: `CUSTOM METRIC ${i}`, explanation: `Explanation ${i}` }));
    expect(() => buildLegendSlideXml(darkTemplate.legend.xml, manyEntries)).not.toThrow();
    const xml = buildLegendSlideXml(darkTemplate.legend.xml, manyEntries);
    expect(xml).toContain("METRIC ABBREVIATION GUIDE");
  });

  it("never touches any slot's icon relationship id — every original r:embed survives", () => {
    const before = [...darkTemplate.legend.xml.matchAll(/r:embed="([^"]*)"/g)].map((m) => m[1]);
    const xml = buildLegendSlideXml(darkTemplate.legend.xml, [entry({ term: "PURCHASES" }), entry({ term: "ROAS" })]);
    const after = [...xml.matchAll(/r:embed="([^"]*)"/g)].map((m) => m[1]);
    expect(after).toEqual(before);
  });

  it("splits a long unmatched metric name across two title runs like the template abbreviations", () => {
    const xml = buildLegendSlideXml(darkTemplate.legend.xml, [
      entry({ term: "COST PER WEBSITE SUBMISSION", explanation: "Average cost per website lead form submission." }),
    ]);
    expect(xml).toContain("CPWS");
    expect(xml).not.toContain("COST PER WEBSITE SUBMISSION");
    expect(xml).toContain("Average cost per website lead form submission.");
  });

  it("shortens the Learning Phase card description so it stays inside the card at 12pt", () => {
    const xml = buildLegendSlideXml(darkTemplate.legend.xml, []);
    expect(xml).toContain("When Meta's system is still learning the best way to deliver your ads.");
    expect(xml).not.toContain("Facebook's algorithm is learning the best ways");
  });

  it("produces well-formed XML with balanced shape tags", () => {
    const xml = buildLegendSlideXml(darkTemplate.legend.xml, [entry(), entry({ term: "ROAS" }), entry({ term: "VIDEO VIEWS" })]);
    const openSp = (xml.match(/<p:sp>/g) || []).length;
    const closeSp = (xml.match(/<\/p:sp>/g) || []).length;
    expect(openSp).toBe(closeSp);
    expect(openSp).toBeGreaterThan(0);
  });

  it("works generically against the Google Ads template's own, different 12 entries (COST, CLICKS, etc.)", () => {
    const xml = buildLegendSlideXml(googleTemplate.legend.xml, [entry({ term: "AVG. CPC" })]);
    // The Google template's own AVG. CPC card matches and stays untouched.
    expect(xml).toContain("The average cost you paid for each click on your ad.");
    // A genuinely new term for this template still gets a slot.
    const xmlWithNew = buildLegendSlideXml(googleTemplate.legend.xml, [entry({ term: "PURCHASES", explanation: "Purchases explanation" })]);
    expect(xmlWithNew).toContain("PURCHASES");
    expect(xmlWithNew).toContain("Purchases explanation");
  });
});

describe("template font sizes — Metric Abbreviation Guide title and Combined Total table title stay consistent with every other slide (28pt)", () => {
  const templates: [string, () => LoadedTemplate][] = [
    ["dark", () => darkTemplate],
    ["google", () => googleTemplate],
    ["light", () => lightTemplate],
  ];

  for (const [name, getTemplate] of templates) {
    it(`${name} template: legend slide heading is 28pt, not 40pt`, () => {
      const xml = getTemplate().legend.xml;
      expect(xml).not.toContain('sz="4000"');
      expect(xml).toContain("METRIC ABBREVIATION GUIDE");
    });

    it(`${name} template: table slide heading is 28pt, not 40pt`, () => {
      const xml = getTemplate().table.xml;
      expect(xml).not.toContain('sz="4000"');
      expect(xml).toContain('sz="2800"');
    });

    it(`${name} template: legend card description text is at least 10pt (not 9pt)`, () => {
      const xml = getTemplate().legend.xml;
      expect(xml).not.toContain('sz="900"');
      const descriptionRuns = (xml.match(/sz="1000"/g) || []).length;
      expect(descriptionRuns).toBe(12);
    });

    it(`${name} template: legend card title/label text is still at least 11pt`, () => {
      const xml = getTemplate().legend.xml;
      expect(xml).toContain('sz="1400"');
    });
  }
});
