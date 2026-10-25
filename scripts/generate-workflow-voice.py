#!/usr/bin/env python3
"""Narration timed to the 7-scene, 112 BPM workflow film. Writes a 30s stereo wav."""
import asyncio
import subprocess
import sys
from pathlib import Path

import edge_tts

BPM = 112
SCENE_MS = (60_000 / BPM) * 8
TOTAL_SEC = SCENE_MS * 7 / 1000
VOICE = "en-IN-NeerjaNeural"
LINES = [
    "Stop rebuilding slides by hand.",
    "Open Ads reporting, by day.",
    "Lock the metrics that match the objective.",
    "Export the day-level CSV.",
    "Drop that file into NextReport.",
    "Walk the wizard, then generate.",
    "Send the deck today.",
]


async def synth(text: str, path: Path) -> None:
    await edge_tts.Communicate(text, VOICE, rate="-2%").save(str(path))


def duration(path: Path) -> float:
    out = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=nw=1:nk=1",
            str(path),
        ],
        text=True,
    )
    return float(out.strip())


def main() -> None:
    out_wav = Path(sys.argv[1])
    work = out_wav.parent / "voice-lines"
    work.mkdir(parents=True, exist_ok=True)
    slot = SCENE_MS / 1000 - 0.35

    async def all_lines() -> None:
        for i, line in enumerate(LINES):
            await synth(line, work / f"line-{i}.mp3")

    asyncio.run(all_lines())

    inputs = ["-f", "lavfi", "-t", f"{TOTAL_SEC:.3f}", "-i", "anullsrc=r=44100:cl=stereo"]
    filters = []
    mix = ["[0:a]"]
    for i in range(len(LINES)):
        src = work / f"line-{i}.mp3"
        dur = duration(src)
        tempo = 1.0
        if dur > slot:
            tempo = min(1.28, dur / slot)
        delay = int(round(i * SCENE_MS))
        inputs += ["-i", str(src)]
        filters.append(
            f"[{i+1}:a]atempo={tempo:.4f},adelay={delay}|{delay},apad=pad_dur={TOTAL_SEC:.3f}[v{i}]"
        )
        mix.append(f"[v{i}]")
    n = 1 + len(LINES)
    filters.append(
        "".join(mix)
        + f"amix=inputs={n}:duration=first:normalize=0,volume=1.35,"
        + "aformat=sample_fmts=s16:sample_rates=44100:channel_layouts=stereo[a]"
    )
    cmd = [
        "ffmpeg",
        "-y",
        *inputs,
        "-filter_complex",
        ";".join(filters),
        "-map",
        "[a]",
        str(out_wav),
    ]
    subprocess.check_call(cmd)
    print(out_wav)


if __name__ == "__main__":
    main()
