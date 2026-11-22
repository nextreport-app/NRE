import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { loadTemplateBuffer } from "../../pptx/templates";
import { validateAgencyTemplate } from "../validate";
async function changed(edit: (zip: JSZip) => Promise<void>) {
  const zip = await JSZip.loadAsync(await loadTemplateBuffer("DARK"));
  await edit(zip);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
describe("compatible agency templates", () => {
  it.each(["DARK", "LIGHT"] as const)(
    "accepts the untouched %s starter",
    async (variant) =>
      expect(
        (
          await validateAgencyTemplate(
            await loadTemplateBuffer(variant),
            variant,
          )
        ).digest,
      ).toMatch(/^[a-f0-9]{64}$/),
  );
  it("accepts styling changes while preserving fields and geometry", async () => {
    const b = await changed(async (zip) => {
      const p = "ppt/slides/slide2.xml";
      zip.file(
        p,
        (await zip.file(p)!.async("string")).replaceAll(
          'val="FFFFFF"',
          'val="FDFDFD"',
        ),
      );
    });
    expect((await validateAgencyTemplate(b, "DARK")).digest).toHaveLength(64);
  });
  it("rejects a generated/ordinary report without placeholder tokens", async () => {
    const b = await changed(async (zip) => {
      const p = "ppt/slides/slide1.xml";
      zip.file(
        p,
        (await zip.file(p)!.async("string")).replaceAll(
          "{{ACCOUNT_NAME}}",
          "Actual client",
        ),
      );
    });
    await expect(validateAgencyTemplate(b, "DARK")).rejects.toThrow(
      "placeholders",
    );
  });
  it("rejects moved data boxes", async () => {
    const b = await changed(async (zip) => {
      const p = "ppt/slides/slide2.xml";
      zip.file(
        p,
        (await zip.file(p)!.async("string")).replace(
          /<a:off x="[1-9]\d*"/,
          '<a:off x="0"',
        ),
      );
    });
    await expect(validateAgencyTemplate(b, "DARK")).rejects.toThrow(
      "positions",
    );
  });
  it("rejects added slides and changed dimensions", async () => {
    const b = await changed(async (zip) => {
      zip.file("ppt/slides/slide5.xml", "<p:sld/>");
    });
    await expect(validateAgencyTemplate(b, "DARK")).rejects.toThrow(
      "four slides",
    );
  });
  it("rejects external relationships and active/embedded files", async () => {
    const b = await changed(async (zip) => {
      const path = "ppt/_rels/presentation.xml.rels";
      zip.file(
        path,
        (await zip.file(path)!.async("string")).replace(
          "</Relationships>",
          '<Relationship Id="rIdExternal" Target="https://example.com" TargetMode="External"/></Relationships>',
        ),
      );
    });
    await expect(validateAgencyTemplate(b, "DARK")).rejects.toThrow("external");
    const bin = await changed(async (zip) => {
      zip.file("ppt/vbaProject.bin", "macro");
    });
    await expect(validateAgencyTemplate(bin, "DARK")).rejects.toThrow("macros");
  });
  it("rejects oversized and invalid uploads before opening them", async () => {
    await expect(
      validateAgencyTemplate(Buffer.alloc(4 * 1024 * 1024 + 1), "DARK"),
    ).rejects.toMatchObject({ status: 413 });
    await expect(
      validateAgencyTemplate(Buffer.from("not a pptx"), "DARK"),
    ).rejects.toThrow("compatible starter");
  });
});
