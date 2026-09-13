#!/usr/bin/env node
/**
 * Patches meta-ads-light.pptx and ga4-light.pptx — replaces amber heading/branding
 * text colors with dark navy for readability on light backgrounds.
 *
 * Usage: node scripts/refine-light-templates.mjs
 */

import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "templates");
const DARK_INK = "0D1B2E";

/** Amber/orange text fills that read poorly on cream backgrounds. Shape fills unchanged. */
const TEXT_COLOR_REPLACEMENTS = [
  ["F6AD55", DARK_INK],
  ["f6ad55", DARK_INK.toLowerCase()],
  ["C17D0A", DARK_INK],
  ["c17d0a", DARK_INK.toLowerCase()],
  ["ED7D31", DARK_INK],
  ["ed7d31", DARK_INK.toLowerCase()],
  ["D97706", DARK_INK],
  ["d97706", DARK_INK.toLowerCase()],
];

function patchTextColors(xml) {
  let out = xml;
  for (const [from, to] of TEXT_COLOR_REPLACEMENTS) {
    out = out.replaceAll(`srgbClr val="${from}"`, `srgbClr val="${to}"`);
  }
  return out;
}

async function refineTemplate(fileName) {
  const filePath = path.join(OUT_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    console.warn(`Skip ${fileName} — not found`);
    return;
  }
  const zip = await JSZip.loadAsync(fs.readFileSync(filePath));
  const outZip = new JSZip();
  for (const [name, file] of Object.entries(zip.files)) {
    if (file.dir) continue;
    let data = await file.async("nodebuffer");
    if (name.endsWith(".xml") || name.endsWith(".rels")) {
      data = Buffer.from(patchTextColors(data.toString("utf8")), "utf8");
    }
    outZip.file(name, data);
  }
  fs.writeFileSync(filePath, await outZip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
  console.log(`Refined ${filePath}`);
}

async function main() {
  for (const file of [
    "meta-ads-light-cream.pptx",
    "meta-ads-light-pearl.pptx",
    "meta-ads-light-sand.pptx",
    "ga4-light-cream.pptx",
    "ga4-light-pearl.pptx",
    "ga4-light-sand.pptx",
  ]) {
    await refineTemplate(file);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
