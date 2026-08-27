/**
 * Rasterizes SVG to PNG for PPTX embedding. Google Slides rejects SVG image
 * parts (shows a broken-image triangle); PNG is universally supported.
 *
 * Uses @resvg/resvg-wasm (not sharp) — sharp's native libvips binary is
 * unreliable in Vercel's serverless linux-x64 runtime (ERR_DLOPEN_FAILED).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { initWasm, Resvg } from "@resvg/resvg-wasm";

/** Slide is 960×540pt — render at 2× for crisp Slides conversion. */
const CHART_OVERVIEW_PNG_WIDTH_PX = 1920;

let wasmReady: Promise<void> | null = null;

function ensureResvgWasm(): Promise<void> {
  if (!wasmReady) {
    wasmReady = (async () => {
      const wasmPath = join(process.cwd(), "node_modules/@resvg/resvg-wasm/index_bg.wasm");
      await initWasm(readFileSync(wasmPath));
    })();
  }
  return wasmReady;
}

export async function rasterizeSvgToPng(svg: string, widthPx = CHART_OVERVIEW_PNG_WIDTH_PX): Promise<Uint8Array> {
  await ensureResvgWasm();
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: widthPx } });
  return resvg.render().asPng();
}
