#!/usr/bin/env node
/**
 * Builds GA4-branded template assets (dark + three light variants).
 *
 * Usage: node scripts/generate-ga4-templates.mjs
 */

import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "templates");

const LIGHT_SOURCES = [
  { src: "meta-ads-light-cream.pptx", out: "ga4-light-cream.pptx" },
  { src: "meta-ads-light-pearl.pptx", out: "ga4-light-pearl.pptx" },
  { src: "meta-ads-light-sand.pptx", out: "ga4-light-sand.pptx" },
];

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
  if (!fs.existsSync(darkSrc)) {
    console.error("Missing dark.pptx — run from repo root after Meta templates exist.");
    process.exit(1);
  }

  await writePptx(darkSrc, "ga4-dark.pptx", { patchCover: true });

  for (const { src, out } of LIGHT_SOURCES) {
    const lightSrc = path.join(OUT_DIR, src);
    if (!fs.existsSync(lightSrc)) {
      console.error(`Missing ${src} — run node scripts/generate-light-templates.mjs first.`);
      process.exit(1);
    }
    await writePptx(lightSrc, out, { patchCover: true });
  }

  fs.copyFileSync(path.join(OUT_DIR, "ga4-light-cream.pptx"), path.join(OUT_DIR, "ga4-light.pptx"));
  console.log("Updated templates/ga4-light.pptx (cream alias)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
