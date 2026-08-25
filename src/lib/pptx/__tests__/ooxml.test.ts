import { describe, expect, it } from "vitest";
import {
  ensureCardLabelValueGap,
  escapeXmlText,
  findCardIconRelId,
  forceRunStyle,
  hideCardSlot,
  replaceCardIcon,
  replaceCardLabel,
  replaceTagRun,
  replaceTagRunWithSuffix,
  replaceTagRunWithSuffixes,
} from "../ooxml";

const SAMPLE_RUN =
  '<a:r><a:rPr b="1" i="0" lang="en-US" sz="2000" u="none"><a:solidFill><a:schemeClr val="lt1"/></a:solidFill><a:latin typeface="Poppins"/></a:rPr><a:t>{{METRIC_SPEND}}</a:t></a:r>';

describe("escapeXmlText", () => {
  it("escapes & < >", () => {
    expect(escapeXmlText("A & B < C > D")).toBe("A &amp; B &lt; C &gt; D");
  });
});

describe("replaceTagRun", () => {
  it("replaces the tag's text while preserving its rPr", () => {
    const xml = `<a:p>${SAMPLE_RUN}</a:p>`;
    const { xml: out, replaced } = replaceTagRun(xml, "{{METRIC_SPEND}}", "₹1,050");
    expect(replaced).toBe(true);
    expect(out).toContain("₹1,050");
    expect(out).toContain('sz="2000"'); // rPr preserved
    expect(out).toContain('<a:latin typeface="Poppins"/>');
    expect(out).not.toContain("{{METRIC_SPEND}}");
  });

  it("reports replaced: false when the tag is not present", () => {
    const { replaced } = replaceTagRun("<a:p>no tags here</a:p>", "{{MISSING}}", "x");
    expect(replaced).toBe(false);
  });

  it("splits \\n into <a:br/> runs, reusing the same rPr for each line", () => {
    const xml = `<a:p>${SAMPLE_RUN}</a:p>`;
    const { xml: out } = replaceTagRun(xml, "{{METRIC_SPEND}}", "Jul 13 - Jul 19\nFreq: 2.5x avg");
    expect(out).toContain("<a:t>Jul 13 - Jul 19</a:t>");
    expect(out).toContain("<a:br/>");
    expect(out).toContain("<a:t>Freq: 2.5x avg</a:t>");
    expect((out.match(/sz="2000"/g) || []).length).toBe(2); // both line-runs keep the style
  });

  it("applies a bold/size style override", () => {
    const xml = `<a:p>${SAMPLE_RUN}</a:p>`;
    const { xml: out } = replaceTagRun(xml, "{{METRIC_SPEND}}", "text", { bold: false, sizePt: 13 });
    expect(out).toContain('b="0"');
    expect(out).toContain('sz="1300"');
  });

  it("applies an italic style override, e.g. for the cover slide's health-score tooltip line", () => {
    const xml = `<a:p>${SAMPLE_RUN}</a:p>`; // SAMPLE_RUN starts i="0"
    const { xml: out } = replaceTagRun(xml, "{{METRIC_SPEND}}", "text", { italic: true, sizePt: 9, color: "999999" });
    expect(out).toContain('i="1"');
    expect(out).toContain('sz="900"');
    expect(out).toContain('<a:srgbClr val="999999"/>');
  });

  it("forces the font family, overriding the template's own typeface", () => {
    const openSansRun =
      '<a:r><a:rPr b="1" sz="1200"><a:latin typeface="Open Sans"/><a:ea typeface="Open Sans"/><a:cs typeface="Open Sans"/></a:rPr><a:t>{{CAMPAIGN_SUMMARY}}</a:t></a:r>';
    const xml = `<a:p>${openSansRun}</a:p>`;
    const { xml: out } = replaceTagRun(xml, "{{CAMPAIGN_SUMMARY}}", "AI text", {
      bold: false,
      sizePt: 13,
      fontFamily: "Poppins",
    });
    expect(out).not.toContain("Open Sans");
    expect(out).toContain('<a:latin typeface="Poppins"/>');
    expect(out).toContain('<a:ea typeface="Poppins"/>');
    expect(out).toContain('<a:cs typeface="Poppins"/>');
  });

  it("escapes XML special characters in the replacement value", () => {
    const xml = `<a:p>${SAMPLE_RUN}</a:p>`;
    const { xml: out } = replaceTagRun(xml, "{{METRIC_SPEND}}", "A & B");
    expect(out).toContain("A &amp; B");
  });

  it("replaces an existing solidFill with a color override", () => {
    const xml = `<a:p>${SAMPLE_RUN}</a:p>`;
    const { xml: out } = replaceTagRun(xml, "{{METRIC_SPEND}}", "text", { color: "fbbf24" });
    expect(out).toContain('<a:srgbClr val="fbbf24"/>');
    expect(out).not.toContain('<a:schemeClr val="lt1"/>');
  });
});

describe("replaceTagRunWithSuffix", () => {
  it("appends a differently-styled suffix run right after the tag's own run", () => {
    const xml = `<a:p>${SAMPLE_RUN}</a:p>`;
    const { xml: out, replaced } = replaceTagRunWithSuffix(
      xml,
      "{{METRIC_SPEND}}",
      "Shoes - Purchases (Campaign)",
      "  (Inactive)",
      { sizePt: 18 },
      { sizePt: 12, bold: true, color: "fbbf24" },
    );
    expect(replaced).toBe(true);
    expect(out).toContain("<a:t>Shoes - Purchases (Campaign)</a:t>");
    expect(out).toContain("<a:t>  (Inactive)</a:t>");
    // Name run and suffix run are two distinct <a:r> elements, suffix after the name.
    const nameIdx = out.indexOf("Shoes - Purchases (Campaign)");
    const suffixIdx = out.indexOf("(Inactive)");
    expect(suffixIdx).toBeGreaterThan(nameIdx);
    // Suffix run carries its own style, distinct from the name run's.
    expect(out).toContain('<a:srgbClr val="fbbf24"/>');
    expect(out).toContain('sz="1800"'); // name
    expect(out).toContain('sz="1200"'); // suffix
  });

  it("adds no suffix run at all when suffix is null (active campaign — no badge)", () => {
    const xml = `<a:p>${SAMPLE_RUN}</a:p>`;
    const { xml: out } = replaceTagRunWithSuffix(xml, "{{METRIC_SPEND}}", "Shoes - Purchases (Campaign)", null, { sizePt: 18 });
    expect((out.match(/<a:r>/g) || []).length).toBe(1);
    expect(out).not.toContain("Inactive");
  });

  it("reports replaced: false when the tag isn't present", () => {
    const { replaced } = replaceTagRunWithSuffix("<a:p>no tags</a:p>", "{{MISSING}}", "x", "(Inactive)");
    expect(replaced).toBe(false);
  });
});

describe("replaceTagRunWithSuffixes", () => {
  it("appends multiple differently-styled runs, in order, right after the tag's own run", () => {
    const xml = `<a:p>${SAMPLE_RUN}</a:p>`;
    const { xml: out, replaced } = replaceTagRunWithSuffixes(xml, "{{METRIC_SPEND}}", "Shoes - Purchases", { sizePt: 22, bold: true }, [
      { text: " (Campaign)", style: { sizePt: 14, bold: false, color: "f6ad55" } },
      { text: "  (Paused)", style: { sizePt: 12, bold: true, color: "fbbf24" } },
    ]);
    expect(replaced).toBe(true);
    expect(out).toContain("<a:t>Shoes - Purchases</a:t>");
    expect(out).toContain("<a:t> (Campaign)</a:t>");
    expect(out).toContain("<a:t>  (Paused)</a:t>");
    // Three distinct runs, in the order given: name, then type label, then status.
    const nameIdx = out.indexOf("<a:t>Shoes - Purchases</a:t>");
    const labelIdx = out.indexOf("<a:t> (Campaign)</a:t>");
    const statusIdx = out.indexOf("<a:t>  (Paused)</a:t>");
    expect(labelIdx).toBeGreaterThan(nameIdx);
    expect(statusIdx).toBeGreaterThan(labelIdx);
    expect((out.match(/<a:r>/g) || []).length).toBe(3);
    expect(out).toContain('sz="2200"'); // name
    expect(out).toContain('sz="1400"'); // type label
    expect(out).toContain('sz="1200"'); // status
    expect(out).toContain('<a:srgbClr val="f6ad55"/>');
    expect(out).toContain('<a:srgbClr val="fbbf24"/>');
  });

  it("skips null/undefined/empty-text suffix entries without adding a run for them", () => {
    const xml = `<a:p>${SAMPLE_RUN}</a:p>`;
    const { xml: out } = replaceTagRunWithSuffixes(xml, "{{METRIC_SPEND}}", "Brisbane North", { sizePt: 22 }, [
      null,
      { text: "", style: { sizePt: 14 } },
      undefined,
    ]);
    expect((out.match(/<a:r>/g) || []).length).toBe(1);
  });

  it("reports replaced: false when the tag isn't present", () => {
    const { replaced } = replaceTagRunWithSuffixes("<a:p>no tags</a:p>", "{{MISSING}}", "x", undefined, []);
    expect(replaced).toBe(false);
  });
});

describe("forceRunStyle", () => {
  it("forces bold on static (non-tag) template text", () => {
    const run =
      '<a:r><a:rPr b="0" sz="2800"><a:latin typeface="Poppins SemiBold"/></a:rPr><a:t>YOUR WEEKLY PERFORMANCE REPORT</a:t></a:r>';
    const out = forceRunStyle(`<a:p>${run}</a:p>`, "YOUR WEEKLY PERFORMANCE REPORT", { bold: true });
    expect(out).toContain('b="1"');
    expect(out).toContain("YOUR WEEKLY PERFORMANCE REPORT");
  });
});

// Minimal fixtures mirroring templates/dark.pptx's two real card shapes —
// the "full card" style (Spend/Reach/Impressions/Results: one outer
// <p:grpSp> wrapping background + icon group + a label/value text-pair
// sub-group) and the "pair" style (CTR/Cost per Result/CPC: background,
// icon, and label/value text pair as three separate top-level shapes) —
// see replaceCardLabel/findCardIconRelId/replaceCardIcon's own doc
// comments for why both share the one structural fact these rely on: the
// label `<p:sp>` always immediately precedes the value `<p:sp>` as document
// siblings, and the icon `<p:pic>` always immediately precedes that pair.
const FULL_CARD_XML =
  '<p:grpSp><p:nvGrpSpPr><p:cNvPr id="33" name="Card"/></p:nvGrpSpPr>' +
  '<p:sp><p:nvSpPr><p:cNvPr id="34" name="Bg"/></p:nvSpPr><p:spPr/><p:txBody><a:p/></p:txBody></p:sp>' +
  '<p:pic><p:blipFill><a:blip r:embed="rId3"/></p:blipFill></p:pic>' +
  '<p:sp><p:nvSpPr><p:cNvPr id="39" name="Label"/></p:nvSpPr><p:txBody><a:p><a:r><a:rPr sz="1150"/><a:t>AD SPEND</a:t></a:r></a:p></p:txBody></p:sp>' +
  '<p:sp><p:nvSpPr><p:cNvPr id="40" name="Value"/></p:nvSpPr><p:txBody><a:p><a:r><a:rPr sz="2100" b="1"/><a:t>{{METRIC_SPEND}}</a:t></a:r></a:p></p:txBody></p:sp>' +
  "</p:grpSp>";

const PAIR_CARD_XML =
  '<p:sp><p:nvSpPr><p:cNvPr id="65" name="Bg"/></p:nvSpPr><p:spPr/><p:txBody><a:p/></p:txBody></p:sp>' +
  '<p:pic><p:blipFill><a:blip r:embed="rId7"/></p:blipFill></p:pic>' +
  '<p:sp><p:nvSpPr><p:cNvPr id="70" name="Label"/></p:nvSpPr><p:txBody><a:p><a:r><a:rPr sz="1150"/><a:t>CTR (All)</a:t></a:r></a:p></p:txBody></p:sp>' +
  '<p:sp><p:nvSpPr><p:cNvPr id="71" name="Value"/></p:nvSpPr><p:txBody><a:p><a:r><a:rPr sz="2100" b="1"/><a:t>{{METRIC_CTR}}</a:t></a:r></a:p></p:txBody></p:sp>';

describe("replaceCardLabel", () => {
  it("overwrites the label immediately preceding the value tag, preserving that label shape's own run styling (full-card style)", () => {
    const out = replaceCardLabel(FULL_CARD_XML, "{{METRIC_SPEND}}", "WEBSITE LEADS");
    expect(out).toContain("<a:t>WEBSITE LEADS</a:t>");
    expect(out).not.toContain("<a:t>AD SPEND</a:t>");
    expect(out).toContain('sz="1150"'); // label run's own style untouched
    expect(out).toContain("{{METRIC_SPEND}}"); // value tag itself untouched — a separate call handles it
  });

  it("works identically for the pair-card style (3 separate top-level shapes, no enclosing group)", () => {
    const out = replaceCardLabel(PAIR_CARD_XML, "{{METRIC_CTR}}", "COST PER LEAD");
    expect(out).toContain("<a:t>COST PER LEAD</a:t>");
    expect(out).not.toContain("<a:t>CTR (All)</a:t>");
  });

  it("overwrites an existing {{TAG}} label (e.g. the Results card's own {{RESULT_LABEL}}) the same way as literal text", () => {
    const xml = FULL_CARD_XML.replace("<a:t>AD SPEND</a:t>", "<a:t>{{RESULT_LABEL}}</a:t>");
    const out = replaceCardLabel(xml, "{{METRIC_SPEND}}", "PURCHASES");
    expect(out).toContain("<a:t>PURCHASES</a:t>");
    expect(out).not.toContain("{{RESULT_LABEL}}");
  });

  it("no-ops when the value locator text isn't found", () => {
    expect(replaceCardLabel(FULL_CARD_XML, "{{METRIC_NOPE}}", "X")).toBe(FULL_CARD_XML);
  });

  it("applies a style override (e.g. the long-label auto-shrink size) to the label run, alongside its text", () => {
    const out = replaceCardLabel(FULL_CARD_XML, "{{METRIC_SPEND}}", "COST PER WEBSITE LEAD", { sizePt: 10.5 });
    expect(out).toContain("<a:t>COST PER WEBSITE LEAD</a:t>");
    expect(out).toContain('sz="1050"');
    expect(out).not.toContain('sz="1150"');
  });
});

describe("findCardIconRelId / replaceCardIcon", () => {
  it("finds the relationship id of the icon immediately preceding the value tag (full-card style)", () => {
    expect(findCardIconRelId(FULL_CARD_XML, "{{METRIC_SPEND}}")).toBe("rId3");
  });

  it("finds it for the pair-card style too", () => {
    expect(findCardIconRelId(PAIR_CARD_XML, "{{METRIC_CTR}}")).toBe("rId7");
  });

  it("returns null when the value locator text isn't found", () => {
    expect(findCardIconRelId(FULL_CARD_XML, "{{METRIC_NOPE}}")).toBeNull();
  });

  it("swaps that same icon's relationship id, leaving everything else untouched", () => {
    const out = replaceCardIcon(FULL_CARD_XML, "{{METRIC_SPEND}}", "rId9");
    expect(out).toContain('r:embed="rId9"');
    expect(out).not.toContain('r:embed="rId3"');
    expect(out).toContain("<a:t>AD SPEND</a:t>"); // label untouched
  });

  it("is a no-op when the value locator text isn't found", () => {
    expect(replaceCardIcon(FULL_CARD_XML, "{{METRIC_NOPE}}", "rId9")).toBe(FULL_CARD_XML);
  });
});

describe("hideCardSlot", () => {
  it("marks the enclosing full-card group hidden so unused chrome does not render", () => {
    const out = hideCardSlot(FULL_CARD_XML, "{{METRIC_SPEND}}");
    expect(out).toContain('name="Card" hidden="1"');
    expect(out).toContain("{{METRIC_SPEND}}");
  });

  it("hides pair-card siblings (background, icon, label, value)", () => {
    const out = hideCardSlot(PAIR_CARD_XML, "{{METRIC_CTR}}");
    expect(out).toContain('name="Bg" hidden="1"');
    expect(out).toContain('name="Label" hidden="1"');
    expect(out).toContain('name="Value" hidden="1"');
  });

  it("is a no-op when the value locator text isn't found", () => {
    expect(hideCardSlot(FULL_CARD_XML, "{{METRIC_NOPE}}")).toBe(FULL_CARD_XML);
  });
});

// Fixtures with real <a:xfrm> geometry (label bottom vs. value top) —
// FULL_CARD_XML/PAIR_CARD_XML above have no spPr geometry at all, so they
// can't exercise ensureCardLabelValueGap's position math.
const CARD_WITH_TIGHT_GAP =
  '<p:sp><p:nvSpPr><p:cNvPr id="39" name="Label"/></p:nvSpPr>' +
  '<p:spPr><a:xfrm><a:off x="100" y="1000"/><a:ext cx="500" cy="200"/></a:xfrm></p:spPr>' +
  '<p:txBody><a:p><a:r><a:rPr sz="1150"/><a:t>AD SPEND</a:t></a:r></a:p></p:txBody></p:sp>' +
  '<p:sp><p:nvSpPr><p:cNvPr id="40" name="Value"/></p:nvSpPr>' +
  '<p:spPr><a:xfrm><a:off x="100" y="1210"/><a:ext cx="500" cy="300"/></a:xfrm></p:spPr>' +
  '<p:txBody><a:p><a:r><a:rPr sz="2100" b="1"/><a:t>{{METRIC_SPEND}}</a:t></a:r></a:p></p:txBody></p:sp>';

describe("ensureCardLabelValueGap", () => {
  it("pushes the value shape down when the template's built-in gap is below the minimum", () => {
    // Label bottom = 1000 + 200 = 1200; value currently starts at 1210 (a
    // 10 EMU gap) — well under a 50800 EMU (4pt) minimum.
    const out = ensureCardLabelValueGap(CARD_WITH_TIGHT_GAP, "{{METRIC_SPEND}}", 50800);
    expect(out).toContain('<a:off x="100" y="52000"/>'); // 1200 + 50800
    expect(out).not.toContain('<a:off x="100" y="1210"/>');
    // Label geometry and both shapes' other content are untouched.
    expect(out).toContain('<a:off x="100" y="1000"/>');
    expect(out).toContain("<a:t>AD SPEND</a:t>");
  });

  it("does not move the value shape when the existing gap already meets the minimum (never pulls tighter)", () => {
    // Minimum of 5 EMU is already satisfied by the fixture's 10 EMU gap.
    const out = ensureCardLabelValueGap(CARD_WITH_TIGHT_GAP, "{{METRIC_SPEND}}", 5);
    expect(out).toBe(CARD_WITH_TIGHT_GAP);
  });

  it("no-ops when the value locator text isn't found", () => {
    expect(ensureCardLabelValueGap(CARD_WITH_TIGHT_GAP, "{{METRIC_NOPE}}", 50800)).toBe(CARD_WITH_TIGHT_GAP);
  });

  it("no-ops when either shape has no readable xfrm geometry", () => {
    expect(ensureCardLabelValueGap(FULL_CARD_XML, "{{METRIC_SPEND}}", 50800)).toBe(FULL_CARD_XML);
  });
});
