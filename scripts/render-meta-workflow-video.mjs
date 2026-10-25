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
const musicPath = path.join(videoDir, "bgm.mp3");

const SCENE_COUNT = 7;
const SCENE_MS = 10000;
const DURATION_SEC = Math.ceil((SCENE_MS * SCENE_COUNT) / 1000);
const DURATION_MS = DURATION_SEC * 1000 + 800;

fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(videoDir, { recursive: true });

console.log("Generating background music…");
const bgm = spawnSync("node", [path.join(__dirname, "generate-workflow-bgm.mjs"), String(DURATION_SEC), path.join(videoDir, "bgm.wav")], {
  stdio: "inherit",
});
if (bgm.status !== 0) process.exit(bgm.status ?? 1);

console.log("Recording animation with Playwright (1920×1080, high-DPI paint)…");
const browser = await chromium.launch({
  headless: true,
  args: ["--disable-dev-shm-usage", "--font-render-hinting=medium"],
});
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 2,
  recordVideo: { dir: videoDir, size: { width: 1920, height: 1080 } },
});
const page = await context.newPage();
await page.goto(`file://${htmlPath}`, { waitUntil: "load" });
await page.waitForFunction(() => document.fonts?.ready?.then(() => true), null, { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(400);
await page.waitForTimeout(DURATION_MS);
const video = page.video();
await context.close();
if (video) {
  await video.saveAs(rawWebm);
}
await browser.close();

console.log("Encoding high-quality MP4…");
let enc = spawnSync(
  "ffmpeg",
  [
    "-y",
    "-i",
    rawWebm,
    "-vf",
    "fps=30,format=yuv420p",
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-crf",
    "16",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    silentMp4,
  ],
  { stdio: "inherit" },
);
if (enc.status !== 0) process.exit(enc.status ?? 1);

console.log("Muxing background music…");
const fadeOut = Math.max(0, DURATION_SEC - 5);
enc = spawnSync(
  "ffmpeg",
  [
    "-y",
    "-i",
    silentMp4,
    "-i",
    musicPath,
    "-filter_complex",
    `[1:a]volume=0.42,afade=t=in:st=0:d=2.5,afade=t=out:st=${fadeOut}:d=5[a]`,
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
