import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { GA4_TEMPLATE_FILES, META_TEMPLATE_FILES, isLightReportTemplate } from "../templates";

const TEMPLATES_DIR = path.resolve(__dirname, "../../../../templates");

async function loadTags(fileName: string): Promise<string[]> {
  const buffer = fs.readFileSync(path.join(TEMPLATES_DIR, fileName));
  const zip = await JSZip.loadAsync(buffer);
  const tags = new Set<string>();
  for (const name of Object.keys(zip.files)) {
    if (!name.endsWith(".xml")) continue;
    const xml = await zip.file(name)!.async("string");
    for (const m of xml.matchAll(/\{\{[A-Z0-9_]+\}\}/g)) tags.add(m[0]);
  }
  return [...tags].sort();
}

async function layoutHasCornerEllipse(fileName: string): Promise<boolean> {
  const buffer = fs.readFileSync(path.join(TEMPLATES_DIR, fileName));
  const zip = await JSZip.loadAsync(buffer);
  const layout = await zip.file("ppt/slideLayouts/slideLayout1.xml")!.async("string");
  return layout.includes("Google Shape;14;p2") && layout.includes('prst="ellipse"');
}

describe("Report template assets", () => {
  it("maps Dark and light variants to real Meta .pptx files", () => {
    for (const file of Object.values(META_TEMPLATE_FILES)) {
      expect(fs.existsSync(path.join(TEMPLATES_DIR, file))).toBe(true);
    }
  });

  it("maps Dark and light variants to real GA4 .pptx files", () => {
    for (const file of Object.values(GA4_TEMPLATE_FILES)) {
      expect(fs.existsSync(path.join(TEMPLATES_DIR, file))).toBe(true);
    }
  });

  it("preserves the same placeholder tags between dark and light cream Meta templates", async () => {
    const darkTags = await loadTags("dark.pptx");
    const lightTags = await loadTags("meta-ads-light-cream.pptx");
    expect(lightTags).toEqual(darkTags);
  });

  it("flags all three light templates and not dark", () => {
    expect(isLightReportTemplate("LIGHT_CREAM")).toBe(true);
    expect(isLightReportTemplate("LIGHT_PEARL")).toBe(true);
    expect(isLightReportTemplate("LIGHT_SAND")).toBe(true);
    expect(isLightReportTemplate("DARK")).toBe(false);
  });

  it("removes corner gradient ellipse from light templates", async () => {
    for (const file of ["meta-ads-light-cream.pptx", "meta-ads-light-pearl.pptx", "meta-ads-light-sand.pptx"]) {
      expect(await layoutHasCornerEllipse(file)).toBe(false);
    }
  });

  it("uses distinct accent6 backgrounds per light variant", async () => {
    const expected = {
      "meta-ads-light-cream.pptx": "FDF6EC",
      "meta-ads-light-pearl.pptx": "F8FAFC",
      "meta-ads-light-sand.pptx": "F5F0E8",
    } as const;

    for (const [file, bg] of Object.entries(expected)) {
      const buffer = fs.readFileSync(path.join(TEMPLATES_DIR, file));
      const zip = await JSZip.loadAsync(buffer);
      const theme = await zip.file("ppt/theme/theme2.xml")!.async("string");
      expect(theme).toContain(`<a:srgbClr val="${bg}"/>`);
    }
  });

  it("uses Google Analytics cover branding on GA4 dark and light cream", async () => {
    for (const file of ["ga4-dark.pptx", "ga4-light-cream.pptx"]) {
      const buffer = fs.readFileSync(path.join(TEMPLATES_DIR, file));
      const zip = await JSZip.loadAsync(buffer);
      const xml = await zip.file("ppt/slides/slide1.xml")!.async("string");
      expect(xml).toContain("<a:t>Google </a:t>");
      expect(xml).toContain("<a:t>Analytics</a:t>");
      expect(xml).not.toContain("<a:t>Meta </a:t>");
      expect(xml).not.toContain("<a:t>ADS</a:t>");
    }
  });
});
