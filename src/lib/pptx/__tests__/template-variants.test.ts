import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { TEMPLATE_FILES, isLightReportTemplate } from "../templates";

const TEMPLATES_DIR = path.resolve(__dirname, "../../../../templates");

const VARIANT_KEYS = ["OCEAN", "INDIGO", "MOSS", "BURGUNDY", "STEEL", "COPPER"] as const;

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

describe("Meta template color variants", () => {
  it("maps each new enum key to a real .pptx asset", () => {
    for (const key of VARIANT_KEYS) {
      const file = TEMPLATE_FILES[key];
      expect(fs.existsSync(path.join(TEMPLATES_DIR, file))).toBe(true);
    }
  });

  it("preserves the same placeholder tags as dark.pptx", async () => {
    const darkTags = await loadTags("dark.pptx");
    for (const key of VARIANT_KEYS) {
      const tags = await loadTags(TEMPLATE_FILES[key]);
      expect(tags).toEqual(darkTags);
    }
  });

  it("only LIGHT is flagged as a light template", () => {
    expect(isLightReportTemplate("LIGHT")).toBe(true);
    expect(isLightReportTemplate("DARK")).toBe(false);
    for (const key of VARIANT_KEYS) {
      expect(isLightReportTemplate(key)).toBe(false);
    }
  });
});
