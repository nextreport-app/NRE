import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { isLogoValidationError, MAX_LOGO_UPLOAD_BYTES, processLogoUpload } from "../logo-processing";

async function makePng(width: number, height: number): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 4, background: { r: 255, g: 100, b: 0, alpha: 1 } } })
    .png()
    .toBuffer();
}

describe("processLogoUpload", () => {
  it("rejects a file over 2MB", async () => {
    const oversized = Buffer.alloc(MAX_LOGO_UPLOAD_BYTES + 1);
    const result = await processLogoUpload(oversized, "image/png");
    expect(isLogoValidationError(result)).toBe(true);
  });

  it("rejects an empty file", async () => {
    const result = await processLogoUpload(Buffer.alloc(0), "image/png");
    expect(isLogoValidationError(result)).toBe(true);
  });

  it("rejects an unaccepted content type", async () => {
    const png = await makePng(100, 100);
    const result = await processLogoUpload(png, "application/pdf");
    expect(isLogoValidationError(result)).toBe(true);
  });

  it("accepts a PNG and returns its dimensions", async () => {
    const png = await makePng(200, 100);
    const result = await processLogoUpload(png, "image/png");
    expect(isLogoValidationError(result)).toBe(false);
    if (!isLogoValidationError(result)) {
      expect(result.widthPx).toBe(200);
      expect(result.heightPx).toBe(100);
    }
  });

  it("accepts JPEG and WebP, converting both to PNG", async () => {
    const jpeg = await sharp({ create: { width: 50, height: 50, channels: 3, background: { r: 0, g: 0, b: 0 } } })
      .jpeg()
      .toBuffer();
    const jpegResult = await processLogoUpload(jpeg, "image/jpeg");
    expect(isLogoValidationError(jpegResult)).toBe(false);
    if (!isLogoValidationError(jpegResult)) {
      const meta = await sharp(jpegResult.buffer).metadata();
      expect(meta.format).toBe("png");
    }

    const webp = await sharp({ create: { width: 50, height: 50, channels: 3, background: { r: 0, g: 0, b: 0 } } })
      .webp()
      .toBuffer();
    const webpResult = await processLogoUpload(webp, "image/webp");
    expect(isLogoValidationError(webpResult)).toBe(false);
  });

  it("rasterizes SVG to PNG", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><rect width="200" height="100" fill="blue"/></svg>');
    const result = await processLogoUpload(svg, "image/svg+xml");
    expect(isLogoValidationError(result)).toBe(false);
    if (!isLogoValidationError(result)) {
      const meta = await sharp(result.buffer).metadata();
      expect(meta.format).toBe("png");
    }
  });

  it("never upscales past the source resolution when resizing down to the stored max", async () => {
    const png = await makePng(50, 30); // well under the 480px stored cap
    const result = await processLogoUpload(png, "image/png");
    expect(isLogoValidationError(result)).toBe(false);
    if (!isLogoValidationError(result)) {
      expect(result.widthPx).toBe(50);
      expect(result.heightPx).toBe(30);
    }
  });

  it("resizes a large image down to fit the stored max dimension, preserving aspect ratio", async () => {
    const png = await makePng(1000, 500); // 2:1, over the 480px cap
    const result = await processLogoUpload(png, "image/png");
    expect(isLogoValidationError(result)).toBe(false);
    if (!isLogoValidationError(result)) {
      expect(result.widthPx).toBe(480);
      expect(result.heightPx).toBe(240);
    }
  });
});
