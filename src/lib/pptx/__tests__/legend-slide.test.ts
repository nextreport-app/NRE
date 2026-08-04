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
    expect(xml).toContain("METRIC GUIDE");
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
    expect(xml).toContain("METRIC GUIDE");
    expect(xml).toContain("<p:sld");
  });

  it("produces well-formed XML with balanced shape tags", () => {
    const xml = buildLegendSlideXml([entry(), entry({ term: "REACH" }), entry({ term: "CTR" })], BACKGROUND);
    const openSp = (xml.match(/<p:sp>/g) || []).length;
    const closeSp = (xml.match(/<\/p:sp>/g) || []).length;
    expect(openSp).toBe(closeSp);
    expect(openSp).toBeGreaterThan(0);
  });

  it("uses the light-template heading color when isLightTemplate is true", () => {
    const darkXml = buildLegendSlideXml([entry()], BACKGROUND, false);
    const lightXml = buildLegendSlideXml([entry()], BACKGROUND, true);
    expect(darkXml).not.toBe(lightXml);
    expect(lightXml).toContain("C17D0A");
  });
});
