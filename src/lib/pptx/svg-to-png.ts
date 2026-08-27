/**
 * Rasterizes SVG to PNG for PPTX embedding. Google Slides rejects SVG image
 * parts (shows a broken-image triangle); PNG is universally supported.
 *
 * Uses @resvg/resvg-wasm with bundled Poppins TTFs — Vercel serverless has
 * no system fonts, so without explicit fontBuffers all text is omitted and
 * the slide looks blank.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { initWasm, Resvg } from "@resvg/resvg-wasm";

/** Slide is 960×540pt — render at 2× for crisp Slides conversion. */
export const CHART_OVERVIEW_PNG_WIDTH_PX = 1920;

let wasmReady: Promise<void> | null = null;
let fontBuffers: Uint8Array[] | null = null;

function fontsDir(): string {
  return join(process.cwd(), "assets/fonts");
}

function ensureResvgWasm(): Promise<void> {
  if (!wasmReady) {
    wasmReady = (async () => {
      const wasmPath = join(process.cwd(), "node_modules/@resvg/resvg-wasm/index_bg.wasm");
      await initWasm(readFileSync(wasmPath));
    })();
  }
  return wasmReady;
}

function loadFontBuffers(): Uint8Array[] {
  if (!fontBuffers) {
    const dir = fontsDir();
    fontBuffers = [
      new Uint8Array(readFileSync(join(dir, "Poppins-Regular.ttf"))),
      new Uint8Array(readFileSync(join(dir, "Poppins-Bold.ttf"))),
    ];
  }
  return fontBuffers;
}

export async function rasterizeSvgToPng(svg: string, widthPx = CHART_OVERVIEW_PNG_WIDTH_PX): Promise<Uint8Array> {
  await ensureResvgWasm();
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: widthPx },
    font: {
      loadSystemFonts: false,
      fontBuffers: loadFontBuffers(),
      defaultFontFamily: "Poppins",
      sansSerifFamily: "Poppins",
    },
  });
  return resvg.render().asPng();
}
