#!/usr/bin/env node
/**
 * Polishes meta-ads-light.pptx backgrounds for a cleaner premium light look:
 * - soft vertical cream gradient (not flat fill)
 * - thin brand accent stripe along the top edge
 * - removes layout corner ellipse if still present
 * - softens the Combined Total header band (no loud rainbow on light)
 * - keeps cover Meta/F gradient badge (shape 24) untouched
 *
 * Usage: node scripts/refine-light-template-design.mjs
 */

import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "templates");
const META_LIGHT = path.join(OUT_DIR, "meta-ads-light.pptx");

const BG_TOP = "FFFFFF";
const BG_MID = "FDF8F3";
const BG_BOTTOM = "F3EDE5";
const ACCENT6 = "FAF8F5";

const EMPTY_TX_BODY =
  '<p:txBody><a:bodyPr anchorCtr="0" anchor="ctr" bIns="0" lIns="0" rIns="0" tIns="0"/><a:lstStyle/><a:p><a:endParaRPr/></a:p></p:txBody>';

function removeLayoutCornerEllipse(xml) {
  return xml.replace(/<p:sp>(?:(?!<p:sp>).)*?Google Shape;14;p2(?:(?!<\/p:sp>).)*?<\/p:sp>/s, "");
}

function replaceBackgroundSolidWithGradient(xml) {
  return xml.replace(
    /<a:solidFill><a:schemeClr val="accent6"\/><\/a:solidFill>/,
    `<a:gradFill><a:gsLst><a:gs pos="0"><a:srgbClr val="${BG_TOP}"/></a:gs><a:gs pos="55000"><a:srgbClr val="${BG_MID}"/></a:gs><a:gs pos="100000"><a:srgbClr val="${BG_BOTTOM}"/></a:gs></a:gsLst><a:lin ang="5400000" scaled="0"/></a:gradFill>`,
  );
}

function insertTopAccentStripe(xml) {
  if (xml.includes("Light Theme Top Accent")) return xml;
  const stripe = `<p:sp><p:nvSpPr><p:cNvPr id="101" name="Light Theme Top Accent"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="12192000" cy="76200"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:gradFill><a:gsLst><a:gs pos="0"><a:srgbClr val="016ED9"><a:alpha val="38000"/></a:srgbClr></a:gs><a:gs pos="35000"><a:srgbClr val="FF3200"><a:alpha val="32000"/></a:srgbClr></a:gs><a:gs pos="70000"><a:srgbClr val="FFB300"><a:alpha val="30000"/></a:srgbClr></a:gs><a:gs pos="100000"><a:srgbClr val="DA32D0"><a:alpha val="35000"/></a:srgbClr></a:gs></a:gsLst><a:lin ang="0" scaled="0"/></a:gradFill><a:ln><a:noFill/></a:ln></p:spPr>${EMPTY_TX_BODY}</p:sp>`;
  return xml.replace(/(<p:sp><p:nvSpPr><p:cNvPr id="13" name="Google Shape;13;p2")/, `${stripe}$1`);
}

function insertBottomWarmGlow(xml) {
  if (xml.includes("Light Theme Warm Glow")) return xml;
  const glow = `<p:sp><p:nvSpPr><p:cNvPr id="102" name="Light Theme Warm Glow"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="8382000" y="4572000"/><a:ext cx="3810000" cy="2286000"/></a:xfrm><a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom><a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:srgbClr val="FFB300"><a:alpha val="9000"/></a:srgbClr></a:gs><a:gs pos="100000"><a:srgbClr val="FFB300"><a:alpha val="0"/></a:srgbClr></a:gs></a:gsLst><a:lin ang="5400000" scaled="0"/></a:gradFill><a:ln><a:noFill/></a:ln></p:spPr>${EMPTY_TX_BODY}</p:sp>`;
  return xml.replace(/(<p:pic><p:nvPicPr><p:cNvPr id="15" name="Google Shape;15;p2")/, `${glow}$1`);
}

function setThemeAccent6(xml) {
  return xml.replace(
    /<a:accent6><a:srgbClr val="[0-9A-Fa-f]{6}"\/><\/a:accent6>/,
    `<a:accent6><a:srgbClr val="${ACCENT6}"/></a:accent6>`,
  );
}

/** Table slide header band — swap loud rainbow for a soft warm-neutral strip. */
function softenTableHeaderBand(xml) {
  const band =
    /<a:gradFill><a:gsLst><a:gs pos="0"><a:schemeClr val="accent2"\/><\/a:gs><a:gs pos="5000"><a:schemeClr val="accent2"\/><\/a:gs><a:gs pos="41000"><a:schemeClr val="accent1"\/><\/a:gs><a:gs pos="75000"><a:schemeClr val="accent3"\/><\/a:gs><a:gs pos="100000"><a:schemeClr val="accent4"\/><\/a:gs><\/a:gsLst><a:lin ang="0" scaled="0"\/><\/a:gradFill>/g;
  const soft =
    `<a:gradFill><a:gsLst><a:gs pos="0"><a:srgbClr val="EDE6DA"/></a:gs><a:gs pos="50000"><a:srgbClr val="D9CCB8"/></a:gs><a:gs pos="100000"><a:srgbClr val="EDE6DA"/></a:gs></a:gsLst><a:lin ang="0" scaled="0"/></a:gradFill>`;
  return xml.replace(band, soft);
}

/** Softer metric-card borders on light slides. */
function softenCardBorders(xml) {
  return xml.replaceAll('srgbClr val="F0D9B5"', 'srgbClr val="E5DDD0"');
}

/** Remove dark text-highlight smudges left from the dark template. */
function cleanTextHighlights(xml) {
  return xml.replace(/<a:highlight><a:srgbClr val="22262B"\/><\/a:highlight>/g, "");
}

async function refineMetaLight() {
  if (!fs.existsSync(META_LIGHT)) {
    console.error("Missing templates/meta-ads-light.pptx");
    process.exit(1);
  }

  const zip = await JSZip.loadAsync(fs.readFileSync(META_LIGHT));
  const outZip = new JSZip();

  for (const [name, file] of Object.entries(zip.files)) {
    if (file.dir) continue;
    let data = await file.async("nodebuffer");

    if (name.endsWith(".xml")) {
      let text = data.toString("utf8");

      if (name === "ppt/theme/theme2.xml") {
        text = setThemeAccent6(text);
      }
      if (name === "ppt/slideLayouts/slideLayout1.xml") {
        text = removeLayoutCornerEllipse(text);
        text = replaceBackgroundSolidWithGradient(text);
        text = insertTopAccentStripe(text);
        text = insertBottomWarmGlow(text);
      }
      if (name === "ppt/slides/slide3.xml") {
        text = softenTableHeaderBand(text);
      }
      if (name.startsWith("ppt/slides/slide")) {
        text = softenCardBorders(text);
        text = cleanTextHighlights(text);
      }

      data = Buffer.from(text, "utf8");
    }

    outZip.file(name, data);
  }

  fs.writeFileSync(META_LIGHT, await outZip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
  console.log(`Refined ${META_LIGHT}`);
}

async function main() {
  await refineMetaLight();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
