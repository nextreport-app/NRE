import { it, expect } from "vitest";
import JSZip from "jszip";
import { loadTemplateBuffer } from "../../pptx/templates";
import { validateAgencyTemplate } from "../validate";
import { renderAgencyTemplatePreview } from "../preview";
it.each(["DARK", "LIGHT"] as const)(
  "renders a usable %s sample with populated metrics and retained artwork",
  async (variant) => {
    const zip = await JSZip.loadAsync(await loadTemplateBuffer(variant));
    const path = "ppt/slides/slide2.xml";
    zip.file(
      path,
      (await zip.file(path)!.async("string")).replaceAll(
        variant === "LIGHT" ? 'val="E5DDD0"' : 'val="FFFFFF"',
        variant === "LIGHT" ? 'val="E7DED0"' : 'val="FDFDFD"',
      ),
    );
    const buffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
    });
    const validated = await validateAgencyTemplate(buffer, variant);
    const out = await JSZip.loadAsync(
      await renderAgencyTemplatePreview(validated.buffer, variant),
    );
    const slides = await Promise.all(
      Object.keys(out.files)
        .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
        .map((p) => out.file(p)!.async("string")),
    );
    expect(slides.length).toBeGreaterThan(4);
    expect(slides.join(" ")).toContain("Sample lead campaign");
    expect(slides.join(" ")).toContain("Sample traffic campaign");
    expect(slides.join(" ")).not.toMatch(/\{\{[A-Z0-9_]+\}\}/);
    expect(
      slides.join(" ").includes(variant === "LIGHT" ? "E7DED0" : "FDFDFD"),
    ).toBe(true);
  },
  20000,
);
