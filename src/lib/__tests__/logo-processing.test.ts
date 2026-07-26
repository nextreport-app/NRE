import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isLogoValidationError, MAX_LOGO_UPLOAD_BYTES, processLogoUpload } from "../logo-processing";

const FIXTURES_DIR = path.join(__dirname, "fixtures");
const PNG_FIXTURE = fs.readFileSync(path.join(FIXTURES_DIR, "logo.png")); // 300x150
const JPEG_FIXTURE = fs.readFileSync(path.join(FIXTURES_DIR, "logo.jpg")); // 200x200
const WEBP_FIXTURE = fs.readFileSync(path.join(FIXTURES_DIR, "logo.webp")); // 250x100
const SVG_FIXTURE = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><rect width="200" height="100" fill="blue"/></svg>');

describe("processLogoUpload", () => {
  it("rejects a file over 2MB", () => {
    const oversized = Buffer.alloc(MAX_LOGO_UPLOAD_BYTES + 1);
    const result = processLogoUpload(oversized);
    expect(isLogoValidationError(result)).toBe(true);
  });

  it("rejects an empty file", () => {
    const result = processLogoUpload(Buffer.alloc(0));
    expect(isLogoValidationError(result)).toBe(true);
  });

  it("rejects a file that isn't PNG/JPEG/WebP/SVG (bad magic bytes, not just a bad declared type)", () => {
    const result = processLogoUpload(Buffer.from("%PDF-1.4 not an image"));
    expect(isLogoValidationError(result)).toBe(true);
  });

  it("accepts a PNG, unmodified, and reads its real dimensions", () => {
    const result = processLogoUpload(PNG_FIXTURE);
    expect(isLogoValidationError(result)).toBe(false);
    if (!isLogoValidationError(result)) {
      expect(result.format).toBe("png");
      expect(result.widthPx).toBe(300);
      expect(result.heightPx).toBe(150);
      // Never resized/re-encoded — the exact original bytes are stored.
      expect(Buffer.compare(result.buffer, PNG_FIXTURE)).toBe(0);
    }
  });

  it("accepts JPEG and WebP, unmodified", () => {
    const jpegResult = processLogoUpload(JPEG_FIXTURE);
    expect(isLogoValidationError(jpegResult)).toBe(false);
    if (!isLogoValidationError(jpegResult)) {
      expect(jpegResult.format).toBe("jpeg");
      expect(jpegResult.widthPx).toBe(200);
      expect(jpegResult.heightPx).toBe(200);
      expect(Buffer.compare(jpegResult.buffer, JPEG_FIXTURE)).toBe(0);
    }

    const webpResult = processLogoUpload(WEBP_FIXTURE);
    expect(isLogoValidationError(webpResult)).toBe(false);
    if (!isLogoValidationError(webpResult)) {
      expect(webpResult.format).toBe("webp");
      expect(webpResult.widthPx).toBe(250);
      expect(webpResult.heightPx).toBe(100);
    }
  });

  it("accepts SVG, reading its width/height from the root element", () => {
    const result = processLogoUpload(SVG_FIXTURE);
    expect(isLogoValidationError(result)).toBe(false);
    if (!isLogoValidationError(result)) {
      expect(result.format).toBe("svg");
      expect(result.widthPx).toBe(200);
      expect(result.heightPx).toBe(100);
    }
  });

  it("falls back to a neutral default for an SVG with no width/height/viewBox", () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>');
    const result = processLogoUpload(svg);
    expect(isLogoValidationError(result)).toBe(false);
    if (!isLogoValidationError(result)) {
      expect(result.widthPx).toBeGreaterThan(0);
      expect(result.heightPx).toBeGreaterThan(0);
    }
  });

  it("reads SVG dimensions from viewBox when width/height attributes are absent", () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 90"><rect width="320" height="90"/></svg>');
    const result = processLogoUpload(svg);
    expect(isLogoValidationError(result)).toBe(false);
    if (!isLogoValidationError(result)) {
      expect(result.widthPx).toBe(320);
      expect(result.heightPx).toBe(90);
    }
  });
});
