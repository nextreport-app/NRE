import { describe, expect, it } from "vitest";
import { escapeXmlText, forceRunStyle, replaceTagRun } from "../ooxml";

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
