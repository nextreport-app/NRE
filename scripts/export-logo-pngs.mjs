/**
 * One-off export: logo.svg → logo.png, favicon.svg → favicon-32.png + favicon-large.png
 * Run: node scripts/export-logo-pngs.mjs
 */
import sharp from "sharp";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = join(root, "public");

async function svgToPng(svgPath, outPath, size) {
  const svg = readFileSync(svgPath);
  await sharp(svg).resize(size, size).png().toFile(outPath);
  console.log(`Wrote ${outPath} (${size}x${size})`);
}

await svgToPng(join(publicDir, "logo.svg"), join(publicDir, "logo.png"), 512);
await svgToPng(join(publicDir, "favicon.svg"), join(publicDir, "favicon-32.png"), 32);
await svgToPng(join(publicDir, "favicon.svg"), join(publicDir, "favicon-large.png"), 180);
// favicon.ico — single 32px frame; browsers accept PNG-backed ico via sharp
await sharp(readFileSync(join(publicDir, "favicon.svg")))
  .resize(32, 32)
  .toFormat("png")
  .toFile(join(publicDir, "favicon.ico"));

console.log("Wrote favicon.ico (32x32 PNG)");
