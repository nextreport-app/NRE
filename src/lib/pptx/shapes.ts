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

function nextShapeId(): number {
  shapeIdCounter += 1;
  return shapeIdCounter;
}

export type ParagraphAlign = "l" | "ctr" | "r";

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
}

export function textBox(opts: TextBoxOptions): string {
  const id = nextShapeId();
  const align = opts.align ?? "ctr";
  const bold = opts.bold ? "1" : "0";
  const font = opts.fontFamily ?? "Poppins";
  return (
    `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="TextBox ${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>` +
    `<p:spPr><a:xfrm><a:off x="${ptToEmu(opts.x)}" y="${ptToEmu(opts.y)}"/><a:ext cx="${ptToEmu(opts.w)}" cy="${ptToEmu(opts.h)}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>` +
    `<p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" anchor="t"><a:noAutofit/></a:bodyPr><a:lstStyle/>` +
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
