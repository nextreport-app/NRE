import { describe, it, expect } from "vitest";
import { buildLegendSlideXml, type LegendEntry } from "../legend-slide";
import type { TemplateBackgroundImage } from "../package";

const BACKGROUND: TemplateBackgroundImage = {
  blipXml: '<a:blip r:embed="rId1"/>',
  srcRectXml: "",
  offX: 0,
  offY: 0,
  extCx: 12192000,
  extCy: 6858000,
  mediaTarget: "../media/image1.png",
};

function entry(overrides: Partial<LegendEntry> = {}): LegendEntry {
  return { term: "AD SPEND", explanation: "Total amount spent on ads during this period", ...overrides };
}

describe("buildLegendSlideXml", () => {
  it("includes the title and every entry's term and explanation", () => {
    const xml = buildLegendSlideXml(
      [entry(), entry({ term: "REACH", explanation: "Number of unique people who saw your ad at least once" })],
      BACKGROUND,
    );
    expect(xml).toContain("METRIC ABBREVIATION GUIDE");
    expect(xml).toContain("AD SPEND");
    expect(xml).toContain("Total amount spent on ads during this period");
    expect(xml).toContain("REACH");
    expect(xml).toContain("Number of unique people who saw your ad at least once");
  });

  it("lists only the entries actually passed in — nothing extra, nothing missing", () => {
    const xml = buildLegendSlideXml([entry({ term: "WEBSITE LEADS" })], BACKGROUND);
    const matches = xml.match(/WEBSITE LEADS/g) ?? [];
    expect(matches.length).toBeGreaterThan(0);
    expect(xml).not.toContain("COST PER LEAD");
  });

  it("returns a valid (non-empty) slide even with zero entries", () => {
    const xml = buildLegendSlideXml([], BACKGROUND);
    expect(xml).toContain("METRIC ABBREVIATION GUIDE");
    expect(xml).toContain("<p:sld");
  });

  it("produces well-formed XML with balanced shape tags", () => {
    const xml = buildLegendSlideXml([entry(), entry({ term: "REACH" }), entry({ term: "CTR" })], BACKGROUND);
    const openSp = (xml.match(/<p:sp>/g) || []).length;
    const closeSp = (xml.match(/<\/p:sp>/g) || []).length;
    expect(openSp).toBe(closeSp);
    expect(openSp).toBeGreaterThan(0);
  });

  it("uses the light-template heading color when isLightTemplate is true, but keeps the card's own colors fixed (always a dark card)", () => {
    const darkXml = buildLegendSlideXml([entry()], BACKGROUND, false);
    const lightXml = buildLegendSlideXml([entry()], BACKGROUND, true);
    expect(darkXml).not.toBe(lightXml);
    expect(lightXml).toContain("C17D0A");
    // Card fill/border/term color are unaffected by the template.
    expect(lightXml).toContain("111f35");
    expect(lightXml).toContain("f6ad55");
  });

  it("draws each entry as a rounded card with the dark navy fill and blue-gray border", () => {
    const xml = buildLegendSlideXml([entry()], BACKGROUND);
    expect(xml).toContain('prst="roundRect"');
    expect(xml).toContain("111f35");
    expect(xml).toContain("1e3a5f");
  });

  it("uppercases the term and colors it amber", () => {
    const xml = buildLegendSlideXml([entry({ term: "reach" })], BACKGROUND);
    expect(xml).toContain("REACH");
    expect(xml).toContain("f6ad55");
  });

  it("never renders a term or explanation smaller than 10pt", () => {
    const manyEntries = Array.from({ length: 20 }, (_, i) => entry({ term: `METRIC ${i + 1}` }));
    const xml = buildLegendSlideXml(manyEntries, BACKGROUND);
    const sizes = [...xml.matchAll(/sz="(\d+)"/g)].map((m) => Number(m[1]) / 100);
    for (const sz of sizes) {
      expect(sz).toBeGreaterThanOrEqual(10);
    }
  });

  it("keeps every entry's y offset within the 540pt-tall slide canvas even with many entries (Fix 2 regression — removing the 8-metric cap can produce a much longer legend)", () => {
    const SLIDE_HEIGHT_PT = 540;
    const manyEntries = Array.from({ length: 16 }, (_, i) => entry({ term: `METRIC ${i + 1}` }));
    const xml = buildLegendSlideXml(manyEntries, BACKGROUND);
    const offsets = [...xml.matchAll(/<a:off x="\d+" y="(\d+)"\/>/g)].map((m) => Number(m[1]) / 12700);
    for (const yPt of offsets) {
      expect(yPt).toBeLessThan(SLIDE_HEIGHT_PT);
    }
  });

  it("always uses a fixed 2-column grid, regardless of entry count", () => {
    const manyEntries = Array.from({ length: 13 }, (_, i) => entry({ term: `METRIC ${i + 1}` }));
    const xml = buildLegendSlideXml(manyEntries, BACKGROUND);
    // 0 is the full-width background/title x offset. Each column contributes
    // 2 distinct x's (the card's own left edge, and its inset text) — so a
    // fixed 2-column grid produces exactly 4 non-zero x's, however many rows.
    const xOffsets = new Set([...xml.matchAll(/<a:off x="(\d+)" y="\d+"\/>/g)].map((m) => Number(m[1])));
    xOffsets.delete(0);
    expect(xOffsets.size).toBe(4);
  });
});
