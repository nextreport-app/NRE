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
push(0, [0xc0, 4]);
push(0, [0xc1, 12]);
push(0, [0xc2, 33]);
push(0, [0xc3, 48]);

const CHORDS = ["C", "G", "Am", "F"];
const TONES = {
  C: [60, 64, 67],
  G: [55, 59, 62],
  Am: [57, 60, 64],
  F: [53, 57, 60],
};
const BASS = { C: 48, G: 43, Am: 45, F: 41 };
const HOOK = {
  C: [76, 79, 84, 86, 84, 79, 76, 74],
  G: [74, 79, 83, 86, 83, 79, 74, 71],
  Am: [76, 81, 84, 88, 84, 81, 76, 72],
  F: [77, 81, 84, 89, 84, 81, 77, 72],
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
    const vel = 78 + ((i * 5) % 12);
    note(1, motif[i], barTick + i * eighth, eighth - 30, vel);
  }

  const root = BASS[name];
  note(2, root, barTick, TPQ - 20, 96);
  note(2, root + 7, barTick + TPQ, Math.floor(TPQ * 0.7), 72);
  note(2, root, barTick + TPQ * 2, TPQ - 20, 88);
  note(2, root + 12, barTick + TPQ * 3, Math.floor(TPQ * 0.6), 70);

  for (let step = 0; step < 8; step++) {
    const t = barTick + step * eighth;
    const open = step === 7;
    note(9, open ? 46 : 42, t, eighth / 2, open ? 58 : 36 + (step % 2) * 8);
    if (step % 2 === 0) note(9, step % 4 === 0 ? 36 : 38, t, eighth, step % 4 === 0 ? 104 : 88);
  }
  if (bar % 2 === 0) note(9, 49, barTick, TPQ, bar === 0 ? 70 : 90);
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
