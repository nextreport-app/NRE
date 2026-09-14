#!/usr/bin/env node
/**
 * Patches meta-ads-light.pptx — removes only the slide-layout corner ellipse
 * glow (top-right navy/blue). Keeps the cover Meta/F gradient badge (shape 24).
 *
 * Usage: node scripts/patch-light-template-corners.mjs
 */

import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "templates");
const META_LIGHT = path.join(OUT_DIR, "meta-ads-light.pptx");

function removeLayoutCornerEllipse(xml) {
  return xml.replace(/<p:sp>(?:(?!<p:sp>).)*?Google Shape;14;p2(?:(?!<\/p:sp>).)*?<\/p:sp>/s, "");
}

async function patchMetaLight() {
  if (!fs.existsSync(META_LIGHT)) {
    console.error("Missing templates/meta-ads-light.pptx");
    process.exit(1);
  }

  const zip = await JSZip.loadAsync(fs.readFileSync(META_LIGHT));
  const outZip = new JSZip();

  for (const [name, file] of Object.entries(zip.files)) {
    if (file.dir) continue;
    let data = await file.async("nodebuffer");
    if (name === "ppt/slideLayouts/slideLayout1.xml") {
      data = Buffer.from(removeLayoutCornerEllipse(data.toString("utf8")), "utf8");
    }
    outZip.file(name, data);
  }

  fs.writeFileSync(META_LIGHT, await outZip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
  console.log(`Patched ${META_LIGHT} — corner ellipse removed, Meta badge kept`);
}

async function main() {
  await patchMetaLight();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
