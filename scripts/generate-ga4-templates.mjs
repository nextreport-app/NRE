#!/usr/bin/env node
/**
 * Builds GA4-branded template assets (dark and light only).
 *
 * Usage: node scripts/generate-ga4-templates.mjs
 */

import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "templates");

/** Meta-branded cover → Google Analytics (matches Google Ads layout: Google + Analytics). */
function patchGa4Cover(xml) {
  return xml
    .replace("<a:t>Meta </a:t>", "<a:t>Google </a:t>")
    .replace("<a:t>ADS</a:t>", "<a:t>Analytics</a:t>");
}

async function writePptx(sourcePath, outFile, { patchCover = false }) {
  const zip = await JSZip.loadAsync(fs.readFileSync(sourcePath));
  const outZip = new JSZip();

  for (const [name, file] of Object.entries(zip.files)) {
    if (file.dir) continue;
    let data = await file.async("nodebuffer");
    if (patchCover && (name.endsWith(".xml") || name.endsWith(".rels"))) {
      let text = data.toString("utf8");
      if (name === "ppt/slides/slide1.xml") {
        text = patchGa4Cover(text);
      }
      data = Buffer.from(text, "utf8");
    }
    outZip.file(name, data);
  }

  const outPath = path.join(OUT_DIR, outFile);
  fs.writeFileSync(outPath, await outZip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
  console.log(`Wrote ${outPath}`);
}

async function main() {
  const darkSrc = path.join(OUT_DIR, "dark.pptx");
  const lightSrc = path.join(OUT_DIR, "meta-ads-light.pptx");
  if (!fs.existsSync(darkSrc) || !fs.existsSync(lightSrc)) {
    console.error("Missing dark.pptx or meta-ads-light.pptx — run from repo root after Meta templates exist.");
    process.exit(1);
  }

  await writePptx(darkSrc, "ga4-dark.pptx", { patchCover: true });
  await writePptx(lightSrc, "ga4-light.pptx", { patchCover: true });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
