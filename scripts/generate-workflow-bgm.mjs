/**
 * 112 BPM explainer score rendered with FluidSynth (GM soundfont).
 * Usage: node scripts/generate-workflow-bgm.mjs <seconds> <out.wav>
 * The picture is 30s / 7 scenes; pass 30 to land a crash on every scene change.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const durationSec = Number(process.argv[2] ?? 30);
const outWav = process.argv[3];
if (!outWav) {
  console.error("Usage: node generate-workflow-bgm.mjs <seconds> <out.wav>");
  process.exit(1);
}

const BPM = 112;
const TPQ = 480;
const BEATS = Math.round((durationSec * BPM) / 60);
const BARS = Math.round(BEATS / 4);
const soundfont = "/usr/share/sounds/sf2/FluidR3_GM.sf2";
const midiPath = outWav.replace(/\.wav$/i, ".mid");

function vlq(n) {
  const bytes = [n & 0x7f];
  let v = n >> 7;
  while (v > 0) {
    bytes.unshift((v & 0x7f) | 0x80);
    v >>= 7;
  }
  return bytes;
}

function trackBytes(events) {
  events.sort((a, b) => a.tick - b.tick || a.ord - b.ord);
  const data = [];
  let last = 0;
  for (const ev of events) {
    const delta = Math.max(0, ev.tick - last);
    last = ev.tick;
    data.push(...vlq(delta), ...ev.bytes);
  }
  data.push(...vlq(0), 0xff, 0x2f, 0x00);
  return Buffer.from(data);
}

function chunk(type, body) {
  const head = Buffer.alloc(8);
  head.write(type, 0);
  head.writeUInt32BE(body.length, 4);
  return Buffer.concat([head, body]);
}

const events = [];
let ord = 0;
const push = (tick, bytes) => events.push({ tick, bytes, ord: ord++ });

const tempo = Math.round(60_000_000 / BPM);
push(0, [0xff, 0x51, 0x03, (tempo >> 16) & 0xff, (tempo >> 8) & 0xff, tempo & 0xff]);
push(0, [0xc0, 24]);
push(0, [0xc1, 0]);
push(0, [0xc2, 35]);
push(0, [0xc3, 48]);

const CHORDS = ["D", "A", "Bm", "G"];
const TONES = {
  D: [62, 66, 69],
  A: [57, 61, 64],
  Bm: [59, 62, 66],
  G: [55, 59, 62],
};
const BASS = { D: 38, A: 45, Bm: 47, G: 43 };
const HOOK = {
  D: [74, 78, 81, 78],
  A: [73, 76, 81, 76],
  Bm: [74, 78, 81, 78],
  G: [74, 79, 83, 79],
};

function note(ch, pitch, tick, dur, vel) {
  push(tick, [0x90 | ch, pitch, vel]);
  push(tick + dur, [0x80 | ch, pitch, 0]);
}

for (let bar = 0; bar < BARS; bar++) {
  const name = CHORDS[Math.floor(bar / 2) % CHORDS.length];
  const barTick = bar * TPQ * 4;
  const tones = TONES[name];
  const eighth = TPQ / 2;

  for (const p of tones) {
    note(0, p, barTick, TPQ * 2 - 20, 46);
    note(0, p, barTick + TPQ * 2, TPQ * 2 - 20, 40);
  }
  note(3, tones[0] - 12, barTick, TPQ * 4 - 10, 34);
  note(3, tones[2], barTick, TPQ * 4 - 10, 28);

  const motif = HOOK[name];
  for (let i = 0; i < motif.length; i++) {
    note(1, motif[i], barTick + i * TPQ, TPQ - 40, 62);
  }

  const root = BASS[name];
  note(2, root, barTick, TPQ * 2 - 30, 84);
  note(2, root + 12, barTick + TPQ * 2, TPQ * 2 - 30, 72);

  for (let step = 0; step < 4; step++) {
    const t = barTick + step * TPQ;
    note(9, 42, t, eighth, 28);
    if (step % 2 === 0) note(9, step === 0 ? 36 : 38, t, TPQ, step === 0 ? 78 : 64);
  }
  if (bar % 2 === 0) note(9, 49, barTick, TPQ, bar === 0 ? 48 : 62);
}

const body = trackBytes(events);
const header = Buffer.alloc(6);
header.writeUInt16BE(0, 0);
header.writeUInt16BE(1, 2);
header.writeUInt16BE(TPQ, 4);
const midi = Buffer.concat([chunk("MThd", header), chunk("MTrk", body)]);
fs.mkdirSync(path.dirname(outWav), { recursive: true });
fs.writeFileSync(midiPath, midi);

if (!fs.existsSync(soundfont)) {
  console.error("Missing soundfont at", soundfont);
  process.exit(1);
}

console.log(`Rendering ${BARS} bars at ${BPM} BPM with FluidSynth…`);
const rendered = spawnSync(
  "fluidsynth",
  ["-ni", "-R", "1", "-C", "1", "-g", "0.75", "-r", "44100", soundfont, midiPath, "-F", outWav],
  { stdio: "inherit" },
);
if (rendered.status !== 0) process.exit(rendered.status ?? 1);

const mp3 = outWav.replace(/\.wav$/i, ".mp3");
const fadeOut = Math.max(0.4, durationSec - 1.6);
const polished = spawnSync(
  "ffmpeg",
  [
    "-y",
    "-t",
    String(durationSec),
    "-i",
    outWav,
    "-af",
    `highpass=f=40,alimiter=limit=0.9,` +
      `afade=t=in:st=0:d=0.25,afade=t=out:st=${fadeOut}:d=1.5`,
    "-c:a",
    "libmp3lame",
    "-q:a",
    "1",
    mp3,
  ],
  { stdio: "inherit" },
);
if (polished.status !== 0) process.exit(polished.status ?? 1);
console.log(mp3);
