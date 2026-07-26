import { describe, expect, it } from "vitest";
import { embedImageInSlide, fitContainEmu, SLIDE_HEIGHT_EMU, SLIDE_WIDTH_EMU } from "../embed-image";
import type { TemplateSlide } from "../package";

describe("fitContainEmu", () => {
  it("scales a wide image (relative to the box) down to fit the box width", () => {
    // 400x160 is 2.5:1 — wider than the 120x60px (2:1) box — so width binds.
    const { cx, cy } = fitContainEmu(400, 160, 120 * 9525, 60 * 9525);
    expect(cx).toBe(120 * 9525);
    expect(cy).toBeCloseTo((160 / 400) * 120 * 9525, -1);
  });

  it("scales a tall image down to fit the box height", () => {
    // 100x300 is far taller (relatively) than the 80x40px (2:1) box — height binds.
    const { cx, cy } = fitContainEmu(100, 300, 80 * 9525, 40 * 9525);
    expect(cy).toBe(40 * 9525);
    expect(cx).toBeCloseTo((100 / 300) * 40 * 9525, -1);
  });

  it("upscales a small image to fill the box, preserving aspect ratio", () => {
    const { cx, cy } = fitContainEmu(20, 20, 120 * 9525, 60 * 9525);
    expect(cx).toBe(cy); // square in, square out
    expect(cx).toBe(60 * 9525); // height-bound since box is wider than tall
  });
});

const BLANK_SLIDE: TemplateSlide = {
  xml: '<p:sld xmlns:p="p" xmlns:a="a" xmlns:r="r"><p:cSld><p:spTree><p:nvGrpSpPr/><p:grpSpPr/></p:spTree></p:cSld></p:sld>',
  rels:
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>',
};

describe("embedImageInSlide", () => {
  it("adds a <p:pic> shape, a new relationship, and returns the media file to write", () => {
    const result = embedImageInSlide(
      BLANK_SLIDE,
      { bytes: new Uint8Array([1, 2, 3]), widthPx: 200, heightPx: 100 },
      { corner: "bottom-right", marginXEmu: 100000, marginYEmu: 100000, maxCxEmu: 120 * 9525, maxCyEmu: 60 * 9525 },
      { mediaFileName: "test-logo.png", shapeName: "Test Logo" },
    );

    expect(result.slide.xml).toContain("<p:pic>");
    expect(result.slide.xml).toContain('name="Test Logo"');
    expect(result.mediaPath).toBe("ppt/media/test-logo.png");
    expect(Array.from(result.mediaBytes)).toEqual([1, 2, 3]);

    // New relationship added, using the next free rId (rId2, since rId1 already exists).
    expect(result.slide.rels).toContain('Id="rId2"');
    expect(result.slide.rels).toContain('Target="../media/test-logo.png"');
    expect(result.slide.rels).toContain(
      'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image"',
    );

    // The <p:pic> embeds via the SAME rId it just registered.
    expect(result.slide.xml).toContain('r:embed="rId2"');
  });

  it("positions bottom-right: right/bottom edges inset by the margins, top-left free", () => {
    const result = embedImageInSlide(
      BLANK_SLIDE,
      { bytes: new Uint8Array(), widthPx: 120, heightPx: 60 }, // exact box aspect ratio, no scaling needed
      { corner: "bottom-right", marginXEmu: 300000, marginYEmu: 300000, maxCxEmu: 120 * 9525, maxCyEmu: 60 * 9525 },
      { mediaFileName: "logo.png", shapeName: "Logo" },
    );
    const cx = 120 * 9525;
    const cy = 60 * 9525;
    const expectedX = SLIDE_WIDTH_EMU - 300000 - cx;
    const expectedY = SLIDE_HEIGHT_EMU - 300000 - cy;
    expect(result.slide.xml).toContain(`<a:off x="${expectedX}" y="${expectedY}"/>`);
    expect(result.slide.xml).toContain(`<a:ext cx="${cx}" cy="${cy}"/>`);
  });

  it("positions bottom-left: x is exactly marginXEmu regardless of marginYEmu", () => {
    const result = embedImageInSlide(
      BLANK_SLIDE,
      { bytes: new Uint8Array(), widthPx: 80, heightPx: 40 },
      { corner: "bottom-left", marginXEmu: 200000, marginYEmu: 1836365, maxCxEmu: 80 * 9525, maxCyEmu: 40 * 9525 },
      { mediaFileName: "logo.png", shapeName: "Logo" },
    );
    expect(result.slide.xml).toContain('<a:off x="200000"');
  });

  it("assigns each embedded shape a unique id, never colliding with existing shapes", () => {
    const slideWithShape: TemplateSlide = {
      xml: BLANK_SLIDE.xml.replace(
        "<p:grpSpPr/>",
        '<p:grpSpPr/><p:sp><p:nvSpPr><p:cNvPr id="42" name="X"/></p:nvSpPr></p:sp>',
      ),
      rels: BLANK_SLIDE.rels,
    };
    const result = embedImageInSlide(
      slideWithShape,
      { bytes: new Uint8Array(), widthPx: 10, heightPx: 10 },
      { corner: "bottom-left", marginXEmu: 0, marginYEmu: 0, maxCxEmu: 1000, maxCyEmu: 1000 },
      { mediaFileName: "logo.png", shapeName: "Logo" },
    );
    expect(result.slide.xml).toContain('<p:cNvPr id="43" name="Logo"');
  });
});
