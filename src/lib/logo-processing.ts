/**
 * Server-side logo upload processing — shared by the client-logo and
 * agency-logo upload routes. Every accepted format is normalized to PNG
 * before it's ever written to Blob storage: this keeps the PPTX embedding
 * layer (embed-image.ts) simple (no need to touch [Content_Types].xml,
 * which already declares a default PNG content type) and means an SVG
 * upload doesn't need OOXML's much more limited native SVG support.
 */

import sharp from "sharp";

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024; // 2MB, matches the product spec
const ACCEPTED_CONTENT_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);

// Logos are only ever displayed small (max 120x60px client / 80x40px
// agency footer) — resizing down to a modest canvas before storing keeps
// Blob usage and PPTX file size sane without visibly softening the result.
// "inside" preserves aspect ratio and never upscales past the source's own
// resolution (a tiny source logo just stays tiny; the PPTX embed layer
// still fits it into its target box at render time).
const MAX_STORED_DIMENSION_PX = 480;

export interface ProcessedLogo {
  buffer: Buffer;
  widthPx: number;
  heightPx: number;
}

export interface LogoValidationError {
  error: string;
}

export function isAcceptedLogoContentType(contentType: string): boolean {
  return ACCEPTED_CONTENT_TYPES.has(contentType);
}

export { MAX_UPLOAD_BYTES as MAX_LOGO_UPLOAD_BYTES };

/**
 * Validates size/format and converts to an optimized PNG. Returns a
 * `{ error }` shape (never throws for expected validation failures) so
 * route handlers can respond with a clean 400 rather than a 500.
 */
export async function processLogoUpload(
  buffer: Buffer,
  contentType: string,
): Promise<ProcessedLogo | LogoValidationError> {
  if (buffer.length === 0) return { error: "Logo file is empty." };
  if (buffer.length > MAX_UPLOAD_BYTES) return { error: "Logo file must be 2MB or smaller." };
  if (!isAcceptedLogoContentType(contentType)) {
    return { error: "Logo must be a PNG, JPG, WebP, or SVG file." };
  }

  try {
    const resized = await sharp(buffer, contentType === "image/svg+xml" ? { density: 300 } : undefined)
      .resize(MAX_STORED_DIMENSION_PX, MAX_STORED_DIMENSION_PX, { fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
    const metadata = await sharp(resized).metadata();
    if (!metadata.width || !metadata.height) {
      return { error: "Could not read logo image dimensions." };
    }
    return { buffer: resized, widthPx: metadata.width, heightPx: metadata.height };
  } catch {
    return { error: "Could not process logo image — the file may be corrupted or an unsupported format." };
  }
}

export function isLogoValidationError(result: ProcessedLogo | LogoValidationError): result is LogoValidationError {
  return "error" in result;
}
