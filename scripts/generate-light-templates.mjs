#!/usr/bin/env node
/**
 * Builds Meta light .pptx variants (cream, pearl, sand) from meta-ads-light.pptx:
 * - flat accent6 background per variant
 * - removes corner gradient ellipse on slideLayout1
 * - removes cover-slide decorative gradient bar (shape 24)
 * - dark navy text (no amber on cream)
 *
 * Usage: node scripts/generate-light-templates.mjs
 */

import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "templates");
const BASE_FILE = "meta-ads-light.pptx";

const DARK_INK = "0D1B2E";

/** Light background options for side-by-side comparison in client settings. */
export const LIGHT_VARIANTS = [
  { key: "cream", file: "meta-ads-light-cream.pptx", bg: "FDF6EC", label: "Warm Cream" },
  { key: "pearl", file: "meta-ads-light-pearl.pptx", bg: "F8FAFC", label: "Cool Pearl" },
  { key: "sand", file: "meta-ads-light-sand.pptx", bg: "F5F0E8", label: "Soft Sand" },
];

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

function setThemeBackground(xml, bgHex) {
  return xml.replace(
    /<a:accent6><a:srgbClr val="[0-9A-Fa-f]{6}"\/><\/a:accent6>/,
    `<a:accent6><a:srgbClr val="${bgHex}"/></a:accent6>`,
  );
}

/** Remove the top-right navy/blue ellipse glow inherited on every slide. */
function removeLayoutCornerEllipse(xml) {
  return xml.replace(/<p:sp>(?:(?!<p:sp>).)*?Google Shape;14;p2(?:(?!<\/p:sp>).)*?<\/p:sp>/s, "");
}

/** Remove the cover slide's colorful bottom-left gradient accent bar. */
function removeCoverDecorativeBar(xml) {
  return xml.replace(/<p:sp>(?:(?!<p:sp>).)*?Google Shape;24;p4(?:(?!<\/p:sp>).)*?<\/p:sp>/s, "");
}

async function buildVariant(sourcePath, variant) {
  const zip = await JSZip.loadAsync(fs.readFileSync(sourcePath));
  const outZip = new JSZip();

  for (const [name, file] of Object.entries(zip.files)) {
    if (file.dir) continue;
    let data = await file.async("nodebuffer");

    if (name.endsWith(".xml") || name.endsWith(".rels")) {
      let text = data.toString("utf8");
      text = patchTextColors(text);

      if (name === "ppt/theme/theme2.xml") {
        text = setThemeBackground(text, variant.bg);
      }
      if (name === "ppt/slideLayouts/slideLayout1.xml") {
        text = removeLayoutCornerEllipse(text);
      }
      if (name === "ppt/slides/slide1.xml") {
        text = removeCoverDecorativeBar(text);
      }

      data = Buffer.from(text, "utf8");
    }

    outZip.file(name, data);
  }

  const outPath = path.join(OUT_DIR, variant.file);
  fs.writeFileSync(outPath, await outZip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
  console.log(`Wrote ${outPath} (${variant.label} #${variant.bg})`);
}

async function main() {
  const basePath = path.join(OUT_DIR, BASE_FILE);
  if (!fs.existsSync(basePath)) {
    console.error(`Missing ${BASE_FILE} — copy or generate the base light template first.`);
    process.exit(1);
  }

  for (const variant of LIGHT_VARIANTS) {
    await buildVariant(basePath, variant);
  }

  // Legacy single-file alias — cream is the default light look.
  fs.copyFileSync(
    path.join(OUT_DIR, "meta-ads-light-cream.pptx"),
    path.join(OUT_DIR, "meta-ads-light.pptx"),
  );
  console.log("Updated templates/meta-ads-light.pptx (cream alias)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
