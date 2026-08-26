/**
 * Rasterizes SVG to PNG for PPTX embedding. Google Slides rejects SVG image
 * parts (shows a broken-image triangle); PNG is universally supported.
 */

import sharp from "sharp";

/** Slide is 960×540pt — render at 2× for crisp Slides conversion. */
const CHART_OVERVIEW_PNG_WIDTH_PX = 1920;

export async function rasterizeSvgToPng(svg: string, widthPx = CHART_OVERVIEW_PNG_WIDTH_PX): Promise<Uint8Array> {
  const png = await sharp(Buffer.from(svg)).resize(widthPx).png().toBuffer();
  return new Uint8Array(png);
}
