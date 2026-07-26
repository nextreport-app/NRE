/**
 * Server-side logo upload validation — used by the client-logo upload
 * route (agency logos were removed as a feature; see render.ts).
 *
 * Deliberately does NOT resize, re-encode, or otherwise process the image:
 * an earlier version used sharp for this, but sharp's prebuilt native
 * binary isn't reliably available in Vercel's serverless runtime, and its
 * WASM fallback (wasm-vips) requires SharedArrayBuffer, which that runtime
 * blocks outright ("ArrayBuffer: SharedArrayBuffer is not allowed").
 * Logos are already small (2MB cap) and only ever displayed small (max
 * 180x90px — see render.ts), so server-side resizing was never load-bearing
 * — the PPTX embedding layer (embed-image.ts) already
 * does its own "contain" fit against the uploaded pixel dimensions, at
 * whatever resolution the file actually is.
 *
 * The one thing still needed from the file is its pixel dimensions, for
 * that same aspect-ratio-preserving fit — gotten by reading the format's
 * header only (image-size for PNG/JPEG/WebP; a small regex parse for SVG's
 * width/height/viewBox), never by decoding pixel data. No native bindings,
 * no WASM, nothing that can hit the SharedArrayBuffer restriction.
 */

import { imageSize } from "image-size";

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024; // 2MB, matches the product spec
export { MAX_UPLOAD_BYTES as MAX_LOGO_UPLOAD_BYTES };

export type LogoFormat = "png" | "jpeg" | "webp" | "svg";

const CONTENT_TYPE_BY_FORMAT: Record<LogoFormat, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml",
};

export function extensionForLogoFormat(format: LogoFormat): string {
  return format === "jpeg" ? "jpg" : format;
}

export function contentTypeForLogoFormat(format: LogoFormat): string {
  return CONTENT_TYPE_BY_FORMAT[format];
}

/**
 * Detects the actual format from the file's own bytes (magic numbers),
 * independent of whatever content-type the browser/OS declared — that
 * declared value is occasionally wrong or missing (SVG in particular),
 * and trusting it blindly would let a mislabeled file get stored under
 * the wrong extension. SVG is detected by content since it's plain
 * text/XML, not a binary magic number.
 */
export function detectLogoFormat(buffer: Buffer): LogoFormat | null {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "png";
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpeg";
  }
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") {
    return "webp";
  }
  // SVG has no fixed magic number — sniff for the root <svg> tag within the
  // leading bytes (covers a possible XML declaration/doctype/BOM first).
  const head = buffer.subarray(0, 2048).toString("utf-8");
  if (/<svg[\s>]/i.test(head)) return "svg";
  return null;
}

function parseSvgDimensions(svgText: string): { width: number; height: number } {
  const DEFAULT_DIMENSIONS = { width: 400, height: 200 };
  const tagMatch = /<svg\b[^>]*>/i.exec(svgText);
  if (!tagMatch) return DEFAULT_DIMENSIONS;
  const tag = tagMatch[0];

  const widthMatch = /\bwidth="([\d.]+)/i.exec(tag);
  const heightMatch = /\bheight="([\d.]+)/i.exec(tag);
  if (widthMatch && heightMatch) {
    const width = parseFloat(widthMatch[1]);
    const height = parseFloat(heightMatch[1]);
    if (width > 0 && height > 0) return { width, height };
  }

  const viewBoxMatch = /\bviewBox="\s*[\d.-]+\s+[\d.-]+\s+([\d.]+)\s+([\d.]+)/i.exec(tag);
  if (viewBoxMatch) {
    const width = parseFloat(viewBoxMatch[1]);
    const height = parseFloat(viewBoxMatch[2]);
    if (width > 0 && height > 0) return { width, height };
  }

  // No usable width/height/viewBox on the root element — fall back to a
  // neutral default rather than failing the whole upload over it; the
  // logo still renders, just fit as if it were this shape.
  return DEFAULT_DIMENSIONS;
}

/**
 * Reads pixel dimensions for an already-known-format image — shared by
 * processLogoUpload below and by the report-generation route, which reads
 * dimensions back from an already-validated, already-stored logo (no
 * re-validation needed there, just the same header-only dimension read).
 * Never throws: SVGs with no usable width/height/viewBox fall back to a
 * neutral default (see parseSvgDimensions) and a corrupt raster file
 * surfaces as a null return rather than an exception.
 */
export function readLogoDimensions(buffer: Buffer, format: LogoFormat): { width: number; height: number } | null {
  if (format === "svg") return parseSvgDimensions(buffer.toString("utf-8"));
  try {
    const { width, height } = imageSize(buffer);
    return width && height ? { width, height } : null;
  } catch {
    return null;
  }
}

export interface ProcessedLogo {
  buffer: Buffer;
  format: LogoFormat;
  widthPx: number;
  heightPx: number;
}

export interface LogoValidationError {
  error: string;
}

/**
 * Validates size and format and reads pixel dimensions. Returns the
 * ORIGINAL, untouched bytes — see the file header for why this no longer
 * resizes/re-encodes. Returns a `{ error }` shape (never throws for
 * expected validation failures) so route handlers can respond with a
 * clean 400 rather than a 500.
 */
export function processLogoUpload(buffer: Buffer): ProcessedLogo | LogoValidationError {
  if (buffer.length === 0) return { error: "Logo file is empty." };
  if (buffer.length > MAX_UPLOAD_BYTES) return { error: "Logo file must be 2MB or smaller." };

  const format = detectLogoFormat(buffer);
  if (!format) return { error: "Logo must be a PNG, JPG, WebP, or SVG file." };

  const dimensions = readLogoDimensions(buffer, format);
  if (!dimensions) return { error: "Could not read logo image — the file may be corrupted." };

  return { buffer, format, widthPx: dimensions.width, heightPx: dimensions.height };
}

export function isLogoValidationError(result: ProcessedLogo | LogoValidationError): result is LogoValidationError {
  return "error" in result;
}
