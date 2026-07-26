/**
 * Injects a new raster image (client/agency logo) into a slide part that
 * didn't originally contain it — the one thing package.ts's loadTemplate/
 * assemblePptx don't support on their own (they only carry the template's
 * OWN media parts through verbatim, see their file header comments).
 *
 * There's no existing OOXML image-embedding code path to build on: every
 * image in templates/dark.pptx today is static, baked into the template at
 * design time. This adds a brand-new `ppt/media/*.png` zip entry, a new
 * `<Relationship>` in the slide's own _rels part, and a new `<p:pic>` shape
 * in the slide XML — modelled directly on the structure of the template's
 * own existing cover-slide Facebook icon `<p:pic>` (inspected via a raw zip
 * read), minus the source-specific `srcRect`/`alphaModFix` tweaks that were
 * particular to that one image.
 */

import { insertShapeBeforeSpTreeClose } from "./ooxml";
import type { TemplateSlide } from "./package";

// Slide canvas — templates/dark.pptx's <p:sldSz>. Every EMU placement below
// is relative to this; keep in sync if the template's slide size ever
// changes (there's no per-call parameter for it since every template slide
// in this deck shares one presentation-wide size).
export const SLIDE_WIDTH_EMU = 12192000;
export const SLIDE_HEIGHT_EMU = 6858000;

const PX_TO_EMU = 9525; // 96dpi, the standard OOXML/CSS pixel

/** "Contain" fit — scales widthPx x heightPx to the largest size that fits within maxCxEmu x maxCyEmu, preserving aspect ratio. */
export function fitContainEmu(
  widthPx: number,
  heightPx: number,
  maxCxEmu: number,
  maxCyEmu: number,
): { cx: number; cy: number } {
  const nativeCx = widthPx * PX_TO_EMU;
  const nativeCy = heightPx * PX_TO_EMU;
  const scale = Math.min(maxCxEmu / nativeCx, maxCyEmu / nativeCy);
  return { cx: Math.round(nativeCx * scale), cy: Math.round(nativeCy * scale) };
}

export interface ImageAsset {
  bytes: Uint8Array;
  widthPx: number;
  heightPx: number;
  /** File extension without a dot (e.g. "png", "jpg", "webp", "svg") — determines the embedded media part's file name and, via ensureContentTypeDefault, its package-level content type declaration. */
  extension: string;
  /** MIME type for the [Content_Types].xml Default entry — see ensureContentTypeDefault. */
  contentType: string;
}

export interface ImageBoxPlacement {
  corner: "bottom-right" | "bottom-left";
  /** Distance from the slide's left (bottom-left) or right (bottom-right) edge. */
  marginXEmu: number;
  /** Distance from the slide's bottom edge — independent of marginXEmu, so a caller can raise a logo above other content without also shifting it horizontally. */
  marginYEmu: number;
  maxCxEmu: number;
  maxCyEmu: number;
}

export interface EmbeddedImageResult {
  slide: TemplateSlide;
  mediaPath: string;
  mediaBytes: Uint8Array;
}

export interface ImageFrameStyle {
  /** Corner radius as a fraction of the shape's smaller dimension (0-0.5), matching OOXML's own roundRect "adj" convention. E.g. 0.09 = 9% — a subtle, noticeable rounding. Omit for square corners. */
  cornerRadiusFraction?: number;
  /** Optional thin outline around the image — e.g. a soft white line to lift a logo off a dark background. */
  border?: {
    widthPt: number;
    colorHex: string;
    /** 0-100; e.g. 80 = 80% opaque ("20% transparent"). */
    opacityPercent: number;
  };
}

function nextRelId(relsXml: string): string {
  const ids = [...relsXml.matchAll(/Id="rId(\d+)"/g)].map((m) => Number(m[1]));
  return `rId${(ids.length ? Math.max(...ids) : 0) + 1}`;
}

function nextShapeId(xml: string): number {
  const ids = [...xml.matchAll(/<p:cNvPr id="(\d+)"/g)].map((m) => Number(m[1]));
  return (ids.length ? Math.max(...ids) : 0) + 1;
}

function addImageRelationship(relsXml: string, relId: string, mediaFileName: string): string {
  const rel = `<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${mediaFileName}"/>`;
  return relsXml.replace("</Relationships>", `${rel}</Relationships>`);
}

function buildPictureShapeXml(params: {
  id: number;
  name: string;
  relId: string;
  x: number;
  y: number;
  cx: number;
  cy: number;
  style?: ImageFrameStyle;
}): string {
  const { id, name, relId, x, y, cx, cy, style } = params;

  const adj = style?.cornerRadiusFraction ? Math.round(style.cornerRadiusFraction * 100000) : 0;
  const geom = adj > 0
    ? `<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val ${adj}"/></a:avLst></a:prstGeom>`
    : `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>`;

  const border = style?.border;
  const line = border
    ? `<a:ln w="${Math.round(border.widthPt * 12700)}"><a:solidFill><a:srgbClr val="${border.colorHex}"><a:alpha val="${Math.round(border.opacityPercent * 1000)}"/></a:srgbClr></a:solidFill></a:ln>`
    : `<a:ln><a:noFill/></a:ln>`;

  return (
    `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="${name}"/><p:cNvPicPr preferRelativeResize="0"/><p:nvPr/></p:nvPicPr>` +
    `<p:blipFill rotWithShape="1"><a:blip r:embed="${relId}"/><a:stretch/></p:blipFill>` +
    `<p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
    `${geom}<a:noFill/>${line}</p:spPr></p:pic>`
  );
}

/**
 * Embeds `image` into `slide` at a corner of the slide canvas, "contain"-fit
 * (preserving aspect ratio) within `box.maxCxEmu` x `box.maxCyEmu`. Returns
 * the updated slide part plus the new media file to add to the assembled
 * zip — callers are responsible for actually writing `mediaBytes` at
 * `mediaPath` into the output package (see render.ts).
 */
export function embedImageInSlide(
  slide: TemplateSlide,
  image: ImageAsset,
  box: ImageBoxPlacement,
  opts: { baseName: string; shapeName: string; style?: ImageFrameStyle },
): EmbeddedImageResult {
  const { cx, cy } = fitContainEmu(image.widthPx, image.heightPx, box.maxCxEmu, box.maxCyEmu);
  const x = box.corner === "bottom-right" ? SLIDE_WIDTH_EMU - box.marginXEmu - cx : box.marginXEmu;
  const y = SLIDE_HEIGHT_EMU - box.marginYEmu - cy;

  const mediaFileName = `${opts.baseName}.${image.extension}`;
  const relId = nextRelId(slide.rels);
  const rels = addImageRelationship(slide.rels, relId, mediaFileName);
  const shapeId = nextShapeId(slide.xml);
  const shapeXml = buildPictureShapeXml({ id: shapeId, name: opts.shapeName, relId, x, y, cx, cy, style: opts.style });
  const xml = insertShapeBeforeSpTreeClose(slide.xml, shapeXml);

  return { slide: { xml, rels }, mediaPath: `ppt/media/${mediaFileName}`, mediaBytes: image.bytes };
}

/**
 * Ensures `[Content_Types].xml` declares a Default content type for
 * `extension` — templates/dark.pptx only ships a Default for "png" (the
 * only format it originally needed), so a JPEG/WebP/SVG logo embed needs
 * its own Default added at render time or PowerPoint/LibreOffice won't
 * know how to interpret that media part. No-ops if already present (e.g.
 * "png", or the same non-PNG format used for both the client and agency
 * logo in one render).
 */
export function ensureContentTypeDefault(contentTypesXml: string, extension: string, contentType: string): string {
  if (new RegExp(`Extension="${extension}"`).test(contentTypesXml)) return contentTypesXml;
  const entry = `<Default ContentType="${contentType}" Extension="${extension}"/>`;
  return contentTypesXml.replace("</Types>", `${entry}</Types>`);
}
