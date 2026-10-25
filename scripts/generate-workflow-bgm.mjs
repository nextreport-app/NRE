/**
 * Generates a short corporate-style ambient bed (royalty-free, no external downloads).
 * Output: WAV path passed as argv[2] or default .tmp-workflow-video/bgm.wav
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const durationSec = Number(process.argv[2] ?? 80);
const outWav =
  process.argv[3] ?? path.join(root, ".tmp-workflow-video", "bgm.wav");
const outMp3 = outWav.replace(/\.wav$/i, ".mp3");

fs.mkdirSync(path.dirname(outWav), { recursive: true });

const sampleRate = 44100;
const len = Math.floor(sampleRate * durationSec);
const samples = new Float32Array(len);
const bpm = 92;
const notes = [261.63, 329.63, 392.0, 493.88, 392.0, 329.63]; // C major arpeggio
const bassNotes = [65.41, 82.41, 98.0, 82.41];

function envAttackDecay(t, attack, decay) {
  if (t < attack) return t / attack;
  return Math.exp(-((t - attack) / decay) * 3);
}

for (let i = 0; i < len; i++) {
  const t = i / sampleRate;
  let s = 0;

  const beat = Math.floor((t * bpm) / 60);
  const beatPhase = (t * bpm) / 60 - beat;

  const bassFreq = bassNotes[Math.floor(beat / 2) % bassNotes.length];
  s += 0.11 * envAttackDecay(beatPhase, 0.02, 0.35) * Math.sin(2 * Math.PI * bassFreq * t);

  const noteFreq = notes[beat % notes.length];
  s +=
    0.07 * envAttackDecay(beatPhase, 0.008, 0.22) * Math.sin(2 * Math.PI * noteFreq * t * 1.001);

  s += 0.028 * Math.sin(2 * Math.PI * 261.63 * t);
  s += 0.022 * Math.sin(2 * Math.PI * 392.0 * t + 0.4);
  s += 0.018 * Math.sin(2 * Math.PI * 523.25 * t + 0.9);

  const shimmer = Math.sin(2 * Math.PI * 2.5 * t) * 0.012;
  s += shimmer * Math.sin(2 * Math.PI * 880 * t);

  const noise = (Math.random() * 2 - 1) * 0.004;
  s += noise;

  samples[i] = Math.max(-1, Math.min(1, s * 0.85));
}

function writeWav(filePath, floatSamples) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = floatSamples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < floatSamples.length; i++) {
    const v = Math.max(-1, Math.min(1, floatSamples[i]));
    buffer.writeInt16LE(Math.floor(v * 32767), 44 + i * 2);
  }
  fs.writeFileSync(filePath, buffer);
}

writeWav(outWav, samples);

const fadeOut = Math.max(0, durationSec - 5);
const r = spawnSync(
  "ffmpeg",
  [
    "-y",
    "-i",
    outWav,
    "-af",
    `highpass=f=80,lowpass=f=12000,aecho=0.6:0.55:800:0.25,` +
      `afade=t=in:st=0:d=2.5,afade=t=out:st=${fadeOut}:d=5,volume=0.9`,
    "-c:a",
    "libmp3lame",
    "-q:a",
    "2",
    outMp3,
  ],
  { stdio: "inherit" },
);
if (r.status !== 0) process.exit(r.status ?? 1);
console.log(outMp3);
