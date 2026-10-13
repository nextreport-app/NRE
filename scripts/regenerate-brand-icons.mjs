/**
 * Regenerates logo.png and favicon PNG/ICO from public/logo.svg + public/favicon.svg.
 * Run: node scripts/regenerate-brand-icons.mjs
 */
import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const logoSvg = readFileSync(join(root, "public/logo.svg"));
const faviconSvg = readFileSync(join(root, "public/favicon.svg"));

async function pngFromSvg(svg, size) {
  return sharp(svg, { density: Math.max(192, size * 4) })
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

function encodeIco(images) {
  const count = images.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);
  let offset = 6 + count * 16;
  const parts = [header];
  for (const { width, height, buf } of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(width >= 256 ? 0 : width, 0);
    entry.writeUInt8(height >= 256 ? 0 : height, 1);
    entry.writeUInt32LE(buf.length, 8);
    entry.writeUInt32LE(offset, 12);
    parts.push(entry, buf);
    offset += buf.length;
  }
  return Buffer.concat(parts);
}

writeFileSync(join(root, "public/logo.png"), await pngFromSvg(logoSvg, 512));

const fav16 = await pngFromSvg(faviconSvg, 16);
const fav32 = await pngFromSvg(faviconSvg, 32);
const fav48 = await pngFromSvg(faviconSvg, 48);
writeFileSync(join(root, "public/favicon-32.png"), fav32);
writeFileSync(join(root, "public/favicon.png"), fav48);
writeFileSync(join(root, "public/favicon-large.png"), await pngFromSvg(faviconSvg, 180));
writeFileSync(
  join(root, "public/favicon.ico"),
  encodeIco([
    { width: 16, height: 16, buf: fav16 },
    { width: 32, height: 32, buf: fav32 },
    { width: 48, height: 48, buf: fav48 },
  ]),
);

console.log("Regenerated public/logo.png, favicon PNGs, and favicon.ico");
