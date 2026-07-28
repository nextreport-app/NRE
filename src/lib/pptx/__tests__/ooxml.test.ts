import { describe, expect, it } from "vitest";
import { escapeXmlText, forceRunStyle, replaceTagRun, replaceTagRunWithSuffix } from "../ooxml";

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

describe("forceRunStyle", () => {
  it("forces bold on static (non-tag) template text", () => {
    const run =
      '<a:r><a:rPr b="0" sz="2800"><a:latin typeface="Poppins SemiBold"/></a:rPr><a:t>YOUR WEEKLY PERFORMANCE REPORT</a:t></a:r>';
    const out = forceRunStyle(`<a:p>${run}</a:p>`, "YOUR WEEKLY PERFORMANCE REPORT", { bold: true });
    expect(out).toContain('b="1"');
    expect(out).toContain("YOUR WEEKLY PERFORMANCE REPORT");
  });
});
