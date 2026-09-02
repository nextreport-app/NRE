/**
 * Raw OOXML <p:sp> builders for shapes drawn natively (no template reuse) —
 * used for the MTD performance chart slide, a from-scratch port of
 * addVisualScorecardSlide_'s insertShape/insertTextBox calls into DrawingML.
 * Coordinates are in points, matching the source's Slides API coordinates
 * (Slides page size is 960x540pt, same as this template's 12192000x6858000
 * EMU slide size — 1pt = 12700 EMU).
 */

import { escapeXmlText, ptToEmu } from "./ooxml";

let shapeIdCounter = 1;

export function resetShapeIdCounter(start = 2): void {
  shapeIdCounter = start;
}

/** Shared, slide-scoped id sequence for every from-scratch shape built by this module — kept unique via resetShapeIdCounter, called once per slide before any shapes.ts builder runs (see fill-tags.ts/chart-slide.ts/legend-slide.ts). */
export function nextShapeId(): number {
  shapeIdCounter += 1;
  return shapeIdCounter;
}

export type ParagraphAlign = "l" | "ctr" | "r";
export type TextAnchor = "t" | "ctr" | "b";

export interface RectOptions {
  x: number;
  y: number;
  w: number;
  h: number;
  fillHex: string; // no leading '#'
}

export function rectangle(opts: RectOptions): string {
  const id = nextShapeId();
  return (
    `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Rectangle ${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>` +
    `<p:spPr><a:xfrm><a:off x="${ptToEmu(opts.x)}" y="${ptToEmu(opts.y)}"/><a:ext cx="${ptToEmu(opts.w)}" cy="${ptToEmu(opts.h)}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>` +
    `<a:solidFill><a:srgbClr val="${opts.fillHex}"/></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr>` +
    `<p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody></p:sp>`
  );
}

export interface RoundedCardOptions {
  x: number;
  y: number;
  w: number;
  h: number;
  fillHex: string;
  strokeHex: string;
  /** Corner radius in points — converted to the roundRect preset's own "adj" guide value (a fraction, in 1/100000ths, of the shape's shorter side), matching how the real template's own card shapes are drawn (see templates/dark.pptx's slide2.xml). */
  radiusPt: number;
  strokeWidthPt?: number;
}

/** A rounded-rectangle card with a solid fill and a thin border — unlike rectangle() (always noFill stroke, square corners), this is for from-scratch card-style shapes (see legend-slide.ts's metric cards) that need to visually match the template's own card styling. */
export function roundedCard(opts: RoundedCardOptions): string {
  const id = nextShapeId();
  const wEmu = ptToEmu(opts.w);
  const hEmu = ptToEmu(opts.h);
  const radiusEmu = ptToEmu(opts.radiusPt);
  const adj = Math.round((radiusEmu / Math.min(wEmu, hEmu)) * 100000);
  const strokeWidthEmu = ptToEmu(opts.strokeWidthPt ?? 1);
  return (
    `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Card ${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>` +
    `<p:spPr><a:xfrm><a:off x="${ptToEmu(opts.x)}" y="${ptToEmu(opts.y)}"/><a:ext cx="${wEmu}" cy="${hEmu}"/></a:xfrm>` +
    `<a:prstGeom prst="roundRect"><a:avLst><a:gd fmla="val ${adj}" name="adj"/></a:avLst></a:prstGeom>` +
    `<a:solidFill><a:srgbClr val="${opts.fillHex}"/></a:solidFill>` +
    `<a:ln w="${strokeWidthEmu}"><a:solidFill><a:srgbClr val="${opts.strokeHex}"/></a:solidFill></a:ln></p:spPr>` +
    `<p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody></p:sp>`
  );
}

export interface EllipseOptions {
  x: number;
  y: number;
  d: number; // diameter
  fillHex: string;
}

export function ellipse(opts: EllipseOptions): string {
  const id = nextShapeId();
  return (
    `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Ellipse ${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>` +
    `<p:spPr><a:xfrm><a:off x="${ptToEmu(opts.x)}" y="${ptToEmu(opts.y)}"/><a:ext cx="${ptToEmu(opts.d)}" cy="${ptToEmu(opts.d)}"/></a:xfrm>` +
    `<a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom>` +
    `<a:solidFill><a:srgbClr val="${opts.fillHex}"/></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr>` +
    `<p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody></p:sp>`
  );
}

/** Degrees → DrawingML angle adjust (60 000 per degree, 0° = 3 o'clock). */
function degToAdj(deg: number): number {
  return Math.round((((deg % 360) + 360) % 360) * 60000);
}

export interface PieWedgeOptions {
  x: number;
  y: number;
  d: number;
  /** Start angle in degrees, 0 = 3 o'clock, clockwise. */
  startDeg: number;
  /** End angle in degrees. */
  endDeg: number;
  fillHex: string;
}

/** One filled pie slice — building block for cross-app donut rings. */
export function pieWedge(opts: PieWedgeOptions): string {
  const id = nextShapeId();
  return (
    `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="PieWedge ${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>` +
    `<p:spPr><a:xfrm><a:off x="${ptToEmu(opts.x)}" y="${ptToEmu(opts.y)}"/><a:ext cx="${ptToEmu(opts.d)}" cy="${ptToEmu(opts.d)}"/></a:xfrm>` +
    `<a:prstGeom prst="pie"><a:avLst><a:gd fmla="val ${degToAdj(opts.startDeg)}" name="adj1"/><a:gd fmla="val ${degToAdj(opts.endDeg)}" name="adj2"/></a:avLst></a:prstGeom>` +
    `<a:solidFill><a:srgbClr val="${opts.fillHex}"/></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr>` +
    `<p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody></p:sp>`
  );
}

export interface DonutRingSegment {
  startDeg: number;
  endDeg: number;
  fillHex: string;
}

export interface DonutRingOptions {
  x: number;
  y: number;
  d: number;
  segments: DonutRingSegment[];
  /** Inner hole diameter as a fraction of outer diameter — see DONUT_HOLE_RATIO in chart-slide-constants.ts. */
  holeRatio?: number;
  holeFillHex: string;
}

/**
 * Donut ring built from pie wedges + a center cover disc. Renders reliably in
 * PowerPoint and Google Slides; blockArc often distorts in Slides.
 */
export function donutRing(opts: DonutRingOptions): string[] {
  const parts: string[] = [];
  for (const seg of opts.segments) {
    if (seg.endDeg <= seg.startDeg) continue;
    parts.push(
      pieWedge({
        x: opts.x,
        y: opts.y,
        d: opts.d,
        startDeg: seg.startDeg,
        endDeg: seg.endDeg,
        fillHex: seg.fillHex,
      }),
    );
  }
  const holeRatio = opts.holeRatio ?? 0.65;
  const innerD = opts.d * holeRatio;
  const inset = (opts.d - innerD) / 2;
  parts.push(
    ellipse({
      x: opts.x + inset,
      y: opts.y + inset,
      d: innerD,
      fillHex: opts.holeFillHex,
    }),
  );
  return parts;
}

export interface BlockArcOptions {
  x: number;
  y: number;
  d: number;
  /** Start angle in degrees, 0 = 3 o'clock, clockwise. */
  startDeg: number;
  /** End angle in degrees. */
  endDeg: number;
  fillHex: string;
  /** Inner radius as fraction of outer (0–1). Default 0.58 for a donut hole. */
  innerRadius?: number;
}

/** One wedge of a donut ring — used by the MTD spend-mix overview slide. */
export function blockArc(opts: BlockArcOptions): string {
  const id = nextShapeId();
  const inner = opts.innerRadius ?? 0.58;
  const startAdj = degToAdj(opts.startDeg);
  const endAdj = degToAdj(opts.endDeg);
  const innerAdj = Math.round(Math.min(0.95, Math.max(0.05, inner)) * 50000);
  return (
    `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="DonutArc ${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>` +
    `<p:spPr><a:xfrm><a:off x="${ptToEmu(opts.x)}" y="${ptToEmu(opts.y)}"/><a:ext cx="${ptToEmu(opts.d)}" cy="${ptToEmu(opts.d)}"/></a:xfrm>` +
    `<a:prstGeom prst="blockArc"><a:avLst><a:gd fmla="val ${startAdj}" name="adj1"/><a:gd fmla="val ${endAdj}" name="adj2"/><a:gd fmla="val ${innerAdj}" name="adj3"/></a:avLst></a:prstGeom>` +
    `<a:solidFill><a:srgbClr val="${opts.fillHex}"/></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr>` +
    `<p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody></p:sp>`
  );
}

export interface BackgroundImageOptions {
  relId: string;
  blipXml: string;
  srcRectXml: string;
  /** Already in EMU (copied verbatim from the template's own master), unlike the other builders here which take points. */
  offX: number;
  offY: number;
  extCx: number;
  extCy: number;
}

/** Full-slide background <p:pic>, replicating a picture that already exists elsewhere in the template (see package.ts's TemplateBackgroundImage) onto a from-scratch slide that has no slideMaster/slideLayout inheritance of its own. */
export function backgroundImage(opts: BackgroundImageOptions): string {
  const id = nextShapeId();
  const blip = opts.blipXml.replace(/r:embed="rId\d+"/, `r:embed="${opts.relId}"`);
  return (
    `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="Background"/><p:cNvPicPr preferRelativeResize="0"/><p:nvPr/></p:nvPicPr>` +
    `<p:blipFill rotWithShape="1">${blip}${opts.srcRectXml}<a:stretch/></p:blipFill>` +
    `<p:spPr><a:xfrm><a:off x="${opts.offX}" y="${opts.offY}"/><a:ext cx="${opts.extCx}" cy="${opts.extCy}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr></p:pic>`
  );
}

export interface TextBoxOptions {
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  sizePt: number;
  bold?: boolean;
  colorHex: string; // no leading '#'
  align?: ParagraphAlign;
  fontFamily?: string;
  /** Vertical anchor inside the box. Default top — matches existing callers. */
  anchor?: TextAnchor;
  /** Clip ink that would paint outside the box (unbreakable campaign names). */
  clipOverflow?: boolean;
  /** When true, keep text on a single line (no word wrap). */
  nowrap?: boolean;
}

export function textBox(opts: TextBoxOptions): string {
  const id = nextShapeId();
  const align = opts.align ?? "ctr";
  const bold = opts.bold ? "1" : "0";
  const font = opts.fontFamily ?? "Poppins";
  const bodyAnchor = opts.anchor ?? "t";
  const overflow = opts.clipOverflow ? ' horzOverflow="clip" vertOverflow="clip"' : "";
  const wrap = opts.nowrap ? "none" : "square";
  return (
    `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="TextBox ${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>` +
    `<p:spPr><a:xfrm><a:off x="${ptToEmu(opts.x)}" y="${ptToEmu(opts.y)}"/><a:ext cx="${ptToEmu(opts.w)}" cy="${ptToEmu(opts.h)}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>` +
    `<p:txBody><a:bodyPr wrap="${wrap}" lIns="0" tIns="0" rIns="0" bIns="0" anchor="${bodyAnchor}"${overflow}><a:noAutofit/></a:bodyPr><a:lstStyle/>` +
    `<a:p><a:pPr algn="${align}"/><a:r><a:rPr lang="en-US" sz="${Math.round(opts.sizePt * 100)}" b="${bold}">` +
    `<a:solidFill><a:srgbClr val="${opts.colorHex}"/></a:solidFill>` +
    `<a:latin typeface="${font}"/><a:ea typeface="${font}"/><a:cs typeface="${font}"/></a:rPr>` +
    `<a:t>${escapeXmlText(opts.text)}</a:t></a:r></a:p></p:txBody></p:sp>`
  );
}

/** Wraps a list of already-built <p:sp> XML strings in a minimal, valid, from-scratch slide. */
export function buildBlankSlideXml(shapesXml: string[]): string {
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ` +
    `xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">` +
    `<p:cSld><p:spTree>` +
    `<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>` +
    `<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>` +
    shapesXml.join("") +
    `</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`
  );
}
