#!/usr/bin/env node
/**
 * Generates Meta report template color variants from templates/dark.pptx.
 * Each variant swaps only background gradient (theme accent5/6) and card
 * surface fills — same slide layout, tags, fonts, and metric logic as Dark.
 *
 * Usage: node scripts/generate-meta-template-variants.mjs
 */

import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";

const ROOT = path.resolve(import.meta.dirname, "..");
const SOURCE = path.join(ROOT, "templates/dark.pptx");
const OUT_DIR = path.join(ROOT, "templates");

/** Dark baseline colors in templates/dark.pptx */
const BASE = {
  accent5: "141F46",
  accent6: "0D142F",
  card: "22262B",
};

/**
 * Six fresh dark-theme background palettes (not derived from prior Claude
 * EMERALD/PURPLE/CRIMSON/GRAPHITE assets — those enum slots are repurposed).
 */
const VARIANTS = [
  {
    key: "OCEAN",
    label: "Deep Ocean Teal",
    accent5: "0F2B3D",
    accent6: "091820",
    card: "1A3A4F",
    file: "meta-ads-ocean.pptx",
  },
  {
    key: "INDIGO",
    label: "Royal Indigo",
    accent5: "1E1B4B",
    accent6: "12102F",
    card: "2A2758",
    file: "meta-ads-indigo.pptx",
  },
  {
    key: "MOSS",
    label: "Forest Moss",
    accent5: "1A2E1F",
    accent6: "0F1A12",
    card: "254032",
    file: "meta-ads-moss.pptx",
  },
  {
    key: "BURGUNDY",
    label: "Deep Burgundy",
    accent5: "3D1520",
    accent6: "280E16",
    card: "4E1F2A",
    file: "meta-ads-burgundy.pptx",
  },
  {
    key: "STEEL",
    label: "Cool Steel Blue",
    accent5: "1E2936",
    accent6: "141C26",
    card: "283544",
    file: "meta-ads-steel.pptx",
  },
  {
    key: "COPPER",
    label: "Warm Copper Bronze",
    accent5: "3D2818",
    accent6: "281A0F",
    card: "4E3624",
    file: "meta-ads-copper.pptx",
  },
];

function patchXml(xml, variant) {
  let out = xml;
  out = out.replaceAll(BASE.accent5, variant.accent5);
  out = out.replaceAll(BASE.accent5.toLowerCase(), variant.accent5.toLowerCase());
  out = out.replaceAll(BASE.accent6, variant.accent6);
  out = out.replaceAll(BASE.accent6.toLowerCase(), variant.accent6.toLowerCase());
  out = out.replaceAll(BASE.card, variant.card);
  out = out.replaceAll(BASE.card.toLowerCase(), variant.card.toLowerCase());
  return out;
}

async function buildVariant(variant) {
  const sourceBytes = fs.readFileSync(SOURCE);
  const zip = await JSZip.loadAsync(sourceBytes);
  const outZip = new JSZip();

  for (const [name, file] of Object.entries(zip.files)) {
    if (file.dir) continue;
    let data = await file.async("nodebuffer");
    if (name.endsWith(".xml") || name.endsWith(".rels")) {
      const text = data.toString("utf8");
      data = Buffer.from(patchXml(text, variant), "utf8");
    }
    outZip.file(name, data);
  }

  const outPath = path.join(OUT_DIR, variant.file);
  const buffer = await outZip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  fs.writeFileSync(outPath, buffer);
  console.log(`Wrote ${outPath} (${variant.label})`);
}

async function patchTikTokCover() {
  const tiktokPath = path.join(OUT_DIR, "tiktok-ads-dark.pptx");
  const zip = await JSZip.loadAsync(fs.readFileSync(tiktokPath));
  const slidePath = "ppt/slides/slide1.xml";
  let xml = await zip.file(slidePath).async("string");
  xml = xml.replace("<a:t>Meta </a:t>", "<a:t>TikTok </a:t>");
  zip.file(slidePath, xml);
  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  fs.writeFileSync(tiktokPath, buffer);
  console.log("Patched TikTok cover branding in tiktok-ads-dark.pptx");
}

async function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error(`Missing source template: ${SOURCE}`);
    process.exit(1);
  }
  for (const variant of VARIANTS) {
    await buildVariant(variant);
  }
  await patchTikTokCover();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
