/**
 * Frame-accurate 30fps render of the Meta CSV workflow film + stereo bed.
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
const framesDir = path.join(videoDir, "frames");
const silentMp4 = path.join(outDir, "meta-csv-workflow-demo-silent.mp4");
const finalMp4 = path.join(outDir, "meta-csv-workflow-demo.mp4");
const poster = path.join(outDir, "meta-csv-workflow-poster.jpg");
const musicWav = path.join(videoDir, "bgm.wav");
const musicPath = path.join(videoDir, "bgm.mp3");
const voiceWav = path.join(videoDir, "voice.wav");

const FPS = 30;

fs.mkdirSync(outDir, { recursive: true });
fs.rmSync(framesDir, { recursive: true, force: true });
fs.mkdirSync(framesDir, { recursive: true });

console.log("Opening animation…");
const browser = await chromium.launch({
  headless: true,
  args: ["--disable-dev-shm-usage", "--font-render-hinting=medium"],
});
const page = await browser.newPage({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
});
await page.goto(`file://${htmlPath}`, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
const durationMs = await page.evaluate(() => window.__DURATION);
const frameCount = Math.round((durationMs / 1000) * FPS);
const durationSec = frameCount / FPS;
console.log(`Capturing ${frameCount} frames @ ${FPS}fps (${durationSec.toFixed(2)}s)…`);

for (let f = 0; f < frameCount; f++) {
  const ms = (f / FPS) * 1000;
  await page.evaluate((t) => window.__seek(t), ms);
  const name = String(f).padStart(5, "0");
  await page.screenshot({
    path: path.join(framesDir, `f${name}.jpg`),
    type: "jpeg",
    quality: 94,
  });
  if (f % 90 === 0) console.log(`  frame ${f}/${frameCount}`);
}
await browser.close();

console.log("Generating stereo background music…");
const bgm = spawnSync(
  "node",
  [path.join(__dirname, "generate-workflow-bgm.mjs"), String(Math.ceil(durationSec)), musicWav],
  { stdio: "inherit" },
);
if (bgm.status !== 0) process.exit(bgm.status ?? 1);

console.log("Encoding video…");
let enc = spawnSync(
  "ffmpeg",
  [
    "-y",
    "-framerate",
    String(FPS),
    "-i",
    path.join(framesDir, "f%05d.jpg"),
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-crf",
    "15",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    silentMp4,
  ],
  { stdio: "inherit" },
);
if (enc.status !== 0) process.exit(enc.status ?? 1);

console.log("Recording narration…");
const voice = spawnSync("python3", [path.join(__dirname, "generate-workflow-voice.py"), voiceWav], {
  stdio: "inherit",
});
if (voice.status !== 0) process.exit(voice.status ?? 1);

const fadeOut = Math.max(0, durationSec - 1.5);
console.log("Muxing music under the narration…");
enc = spawnSync(
  "ffmpeg",
  [
    "-y",
    "-i",
    silentMp4,
    "-i",
    musicPath,
    "-i",
    voiceWav,
    "-filter_complex",
    `[2:a]volume=1.08,afade=t=in:st=0:d=0.06,afade=t=out:st=${fadeOut}:d=0.9,asplit=2[vox][sc];` +
      `[1:a]volume=0.32,afade=t=in:st=0:d=0.3,afade=t=out:st=${Math.max(0, fadeOut - 0.2)}:d=1.5[bed];` +
      `[bed][sc]sidechaincompress=threshold=0.015:ratio=8:attack=15:release=320[ducked];` +
      `[ducked][vox]amix=inputs=2:duration=first:normalize=0[a]`,
    "-map",
    "0:v:0",
    "-map",
    "[a]",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-b:a",
    "256k",
    "-shortest",
    finalMp4,
  ],
  { stdio: "inherit" },
);
if (enc.status !== 0) process.exit(enc.status ?? 1);

spawnSync(
  "ffmpeg",
  ["-y", "-ss", "3.4", "-i", finalMp4, "-frames:v", "1", "-q:v", "2", poster],
  { stdio: "inherit" },
);

const artifactDir = "/opt/cursor/artifacts";
fs.mkdirSync(artifactDir, { recursive: true });
fs.copyFileSync(finalMp4, path.join(artifactDir, "meta-csv-workflow-demo.mp4"));
fs.copyFileSync(poster, path.join(artifactDir, "meta-csv-workflow-poster.jpg"));
fs.rmSync(framesDir, { recursive: true, force: true });

console.log("Done", finalMp4);
