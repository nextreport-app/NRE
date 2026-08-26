/**
 * Rasterizes SVG to PNG for PPTX embedding. Google Slides rejects SVG image
 * parts (shows a broken-image triangle); PNG is universally supported.
 */

import { Resvg } from "@resvg/resvg-js";

/** Slide is 960×540pt — render at 2× for crisp Slides conversion. */
const CHART_OVERVIEW_PNG_WIDTH_PX = 1920;

export function rasterizeSvgToPng(svg: string, widthPx = CHART_OVERVIEW_PNG_WIDTH_PX): Uint8Array {
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: widthPx } });
  return resvg.render().asPng();
}
