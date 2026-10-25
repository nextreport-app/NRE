/**
 * Renders public/marketing/meta-csv-workflow-anim.html to MP4 + background music.
 * Usage: node scripts/render-meta-workflow-video.mjs
 */
import { chromium } from "playwright";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const htmlPath = path.join(root, "public/marketing/meta-csv-workflow-anim.html");
const outDir = path.join(root, "public/videos");
const videoDir = path.join(root, ".tmp-workflow-video");
const rawWebm = path.join(videoDir, "capture.webm");
const silentMp4 = path.join(outDir, "meta-csv-workflow-demo-silent.mp4");
const finalMp4 = path.join(outDir, "meta-csv-workflow-demo.mp4");
const musicPath = path.join(videoDir, "bg-music.mp3");

const DURATION_SEC = Math.ceil((9500 * 7) / 1000);
const DURATION_MS = DURATION_SEC * 1000;

fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(videoDir, { recursive: true });

function createBackgroundMusic() {
  console.log("Generating background music (royalty-free synth bed)…");
  const r = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-f",
      "lavfi",
      "-i",
      `sine=frequency=392:duration=${DURATION_SEC}`,
      "-f",
      "lavfi",
      "-i",
      `sine=frequency=523:duration=${DURATION_SEC}`,
      "-f",
      "lavfi",
      "-i",
      `sine=frequency=659:duration=${DURATION_SEC}`,
      "-filter_complex",
      `[0:a]volume=0.035[a0];[1:a]volume=0.028[a1];[2:a]volume=0.022[a2];` +
        `[a0][a1][a2]amix=inputs=3:duration=longest,` +
        `afade=t=in:st=0:d=2,afade=t=out:st=${DURATION_SEC - 4}:d=4`,
      "-c:a",
      "libmp3lame",
      "-q:a",
      "4",
      musicPath,
    ],
    { stdio: "inherit" },
  );
  if (r.status !== 0) throw new Error("ffmpeg music generation failed");
}

createBackgroundMusic();

console.log("Recording animation with Playwright…");
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  recordVideo: { dir: videoDir, size: { width: 1920, height: 1080 } },
});
const page = await context.newPage();
await page.goto(`file://${htmlPath}`);
await page.waitForTimeout(DURATION_MS + 500);
const video = page.video();
await context.close();
if (video) {
  await video.saveAs(rawWebm);
}
await browser.close();

console.log("Encoding silent MP4…");
let enc = spawnSync(
  "ffmpeg",
  ["-y", "-i", rawWebm, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", silentMp4],
  { stdio: "inherit" },
);
if (enc.status !== 0) process.exit(enc.status ?? 1);

console.log("Muxing background music…");
enc = spawnSync(
  "ffmpeg",
  [
    "-y",
    "-i",
    silentMp4,
    "-i",
    musicPath,
    "-filter_complex",
    `[1:a]volume=0.35,afade=t=in:st=0:d=2,afade=t=out:st=${DURATION_SEC - 4}:d=4[a]`,
    "-map",
    "0:v:0",
    "-map",
    "[a]",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-shortest",
    finalMp4,
  ],
  { stdio: "inherit" },
);
if (enc.status !== 0) process.exit(enc.status ?? 1);

const artifactMp4 = "/opt/cursor/artifacts/meta-csv-workflow-demo.mp4";
fs.mkdirSync(path.dirname(artifactMp4), { recursive: true });
fs.copyFileSync(finalMp4, artifactMp4);

console.log("Done:");
console.log(" ", finalMp4);
console.log(" ", artifactMp4);
