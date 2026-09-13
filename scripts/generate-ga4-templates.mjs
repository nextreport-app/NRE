#!/usr/bin/env node
/**
 * Builds GA4-branded template assets (dark, light, and six color variants).
 * Same slide layout/tags as Meta templates — only cover branding and
 * background colors differ.
 *
 * Usage: node scripts/generate-ga4-templates.mjs
 */

import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "templates");

const BASE = {
  accent5: "141F46",
  accent6: "0D142F",
  card: "22262B",
};

const COLOR_VARIANTS = [
  { key: "OCEAN", accent5: "0F2B3D", accent6: "091820", card: "1A3A4F", file: "ga4-ocean.pptx" },
  { key: "INDIGO", accent5: "1E1B4B", accent6: "12102F", card: "2A2758", file: "ga4-indigo.pptx" },
  { key: "MOSS", accent5: "1A2E1F", accent6: "0F1A12", card: "254032", file: "ga4-moss.pptx" },
  { key: "BURGUNDY", accent5: "3D1520", accent6: "280E16", card: "4E1F2A", file: "ga4-burgundy.pptx" },
  { key: "STEEL", accent5: "1E2936", accent6: "141C26", card: "283544", file: "ga4-steel.pptx" },
  { key: "COPPER", accent5: "3D2818", accent6: "281A0F", card: "4E3624", file: "ga4-copper.pptx" },
];

function patchColors(xml, variant) {
  let out = xml;
  for (const [from, to] of [
    [BASE.accent5, variant.accent5],
    [BASE.accent6, variant.accent6],
    [BASE.card, variant.card],
  ]) {
    out = out.replaceAll(from, to);
    out = out.replaceAll(from.toLowerCase(), to.toLowerCase());
  }
  return out;
}

/** Meta-branded cover → Google Analytics (matches Google Ads layout: Google + Analytics). */
function patchGa4Cover(xml) {
  return xml
    .replace("<a:t>Meta </a:t>", "<a:t>Google </a:t>")
    .replace("<a:t>ADS</a:t>", "<a:t>Analytics</a:t>");
}

async function writePptx(sourcePath, outFile, { colorVariant = null, patchCover = false }) {
  const zip = await JSZip.loadAsync(fs.readFileSync(sourcePath));
  const outZip = new JSZip();

  for (const [name, file] of Object.entries(zip.files)) {
    if (file.dir) continue;
    let data = await file.async("nodebuffer");
    if (name.endsWith(".xml") || name.endsWith(".rels")) {
      let text = data.toString("utf8");
      if (patchCover && name === "ppt/slides/slide1.xml") {
        text = patchGa4Cover(text);
      }
      if (colorVariant) {
        text = patchColors(text, colorVariant);
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

  const ga4DarkPath = path.join(OUT_DIR, "ga4-dark.pptx");
  for (const variant of COLOR_VARIANTS) {
    await writePptx(ga4DarkPath, variant.file, { colorVariant: variant, patchCover: false });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
