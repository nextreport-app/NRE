import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { GA4_TEMPLATE_FILES, TEMPLATE_FILES, isLightReportTemplate } from "../templates";

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

describe("Report template assets", () => {
  it("maps Dark and Light to real Meta .pptx files", () => {
    expect(fs.existsSync(path.join(TEMPLATES_DIR, TEMPLATE_FILES.DARK))).toBe(true);
    expect(fs.existsSync(path.join(TEMPLATES_DIR, TEMPLATE_FILES.LIGHT))).toBe(true);
  });

  it("maps Dark and Light to real GA4 .pptx files", () => {
    expect(fs.existsSync(path.join(TEMPLATES_DIR, GA4_TEMPLATE_FILES.DARK))).toBe(true);
    expect(fs.existsSync(path.join(TEMPLATES_DIR, GA4_TEMPLATE_FILES.LIGHT))).toBe(true);
  });

  it("preserves the same placeholder tags between dark and light Meta templates", async () => {
    const darkTags = await loadTags("dark.pptx");
    const lightTags = await loadTags("meta-ads-light.pptx");
    expect(lightTags).toEqual(darkTags);
  });

  it("only LIGHT is flagged as a light template", () => {
    expect(isLightReportTemplate("LIGHT")).toBe(true);
    expect(isLightReportTemplate("DARK")).toBe(false);
  });

  it("uses Google Analytics cover branding on GA4 dark and light", async () => {
    for (const file of ["ga4-dark.pptx", "ga4-light.pptx"]) {
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
