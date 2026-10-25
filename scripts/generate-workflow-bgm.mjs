/**
 * Stereo corporate bed for the homepage workflow film.
 * Usage: node scripts/generate-workflow-bgm.mjs <seconds> <out.wav>
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const durationSec = Number(process.argv[2] ?? 70);
const outWav = process.argv[3];
if (!outWav) {
  console.error("Usage: node generate-workflow-bgm.mjs <seconds> <out.wav>");
  process.exit(1);
}
fs.mkdirSync(path.dirname(outWav), { recursive: true });

const sr = 44100;
const n = Math.floor(sr * durationSec);
const left = new Float32Array(n);
const right = new Float32Array(n);

const bpm = 96;
const beat = 60 / bpm;
const chords = [
  [130.81, 164.81, 196.0, 261.63],
  [110.0, 164.81, 220.0, 261.63],
  [87.31, 130.81, 174.61, 220.0],
  [98.0, 146.83, 196.0, 246.94],
];
const melody = [523.25, 587.33, 659.25, 783.99, 659.25, 587.33, 523.25, 493.88];

function env(phase, a, d) {
  if (phase < 0) return 0;
  if (phase < a) return phase / a;
  return Math.exp(-(phase - a) / d);
}

for (let i = 0; i < n; i++) {
  const t = i / sr;
  const beatIndex = Math.floor(t / beat);
  const phase = t - beatIndex * beat;
  const chord = chords[Math.floor(beatIndex / 4) % chords.length];
  let s = 0;
  for (let c = 0; c < chord.length; c++) {
    const f = chord[c];
    s += (0.045 - c * 0.006) * Math.sin(2 * Math.PI * f * t);
    s += 0.012 * Math.sin(2 * Math.PI * f * 2 * t);
  }
  const mel = melody[beatIndex % melody.length];
  s += 0.07 * env(phase, 0.012, 0.18) * Math.sin(2 * Math.PI * mel * t);
  s += 0.05 * env(phase, 0.004, 0.12) * Math.sin(2 * Math.PI * 55 * (beatIndex % 4 === 0 ? 1 : 0.5) * t) * (beatIndex % 2 === 0 ? 1 : 0.35);
  const hat = (Math.random() * 2 - 1) * (beatIndex % 2 === 1 ? 0.012 : 0.004) * env(phase, 0.001, 0.04);
  s += hat;
  s *= 0.9;
  const delay = Math.floor(sr * 0.018);
  left[i] = s;
  const j = i - delay;
  right[i] = j >= 0 ? s * 0.92 + left[j] * 0.08 : s * 0.92;
}

function writeStereoWav(filePath, l, r) {
  const dataSize = l.length * 4;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(sr, 24);
  buf.writeUInt32LE(sr * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < l.length; i++) {
    const a = Math.max(-1, Math.min(1, l[i]));
    const b = Math.max(-1, Math.min(1, r[i]));
    buf.writeInt16LE((a * 32767) | 0, 44 + i * 4);
    buf.writeInt16LE((b * 32767) | 0, 46 + i * 4);
  }
  fs.writeFileSync(filePath, buf);
}

writeStereoWav(outWav, left, right);
const mp3 = outWav.replace(/\.wav$/i, ".mp3");
const fade = Math.max(0, durationSec - 4);
const r = spawnSync(
  "ffmpeg",
  [
    "-y",
    "-i",
    outWav,
    "-af",
    `highpass=f=70,lowpass=f=9000,aecho=0.7:0.6:420|680:0.28|0.18,` +
      `afade=t=in:st=0:d=1.8,afade=t=out:st=${fade}:d=3.5,volume=1.05`,
    "-c:a",
    "libmp3lame",
    "-q:a",
    "1",
    mp3,
  ],
  { stdio: "inherit" },
);
if (r.status !== 0) process.exit(r.status ?? 1);
console.log(mp3);
