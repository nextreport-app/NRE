"use client";

import { useCallback, useEffect, useState } from "react";

const SCENE_MS = 3200;

const SCENES = [
  {
    id: "pain",
    kicker: "The old way",
    headline: "CSV → copy → PowerPoint → repeat",
    sub: "Every client. Every week. Hours of busywork.",
  },
  {
    id: "upload",
    kicker: "Step 1",
    headline: "Upload your Meta CSV",
    sub: "Day-wise export from Ads Reporting — one file.",
  },
  {
    id: "build",
    kicker: "Step 2",
    headline: "Wizard builds your deck",
    sub: "Campaigns, objectives, metrics — then generate.",
  },
  {
    id: "share",
    kicker: "Done",
    headline: "Branded report in ~2 minutes",
    sub: "Download .pptx, live link, or Google Drive.",
  },
] as const;

function SceneVisual({ sceneId }: { sceneId: (typeof SCENES)[number]["id"] }) {
  switch (sceneId) {
    case "pain":
      return (
        <div className="nre-story-scene nre-story-scene--pain relative mx-auto flex h-[168px] w-full max-w-[300px] items-center justify-center">
          <div className="nre-story-float nre-story-float--a absolute left-2 top-6 rounded-lg border border-red-500/30 bg-[#1a1520] px-3 py-2 text-[10px] font-medium text-red-200/90 shadow-lg">
            📊 Spreadsheet
          </div>
          <div className="nre-story-float nre-story-float--b absolute right-0 top-2 rounded-lg border border-amber-500/25 bg-[#1a1810] px-3 py-2 text-[10px] font-medium text-amber-100/90 shadow-lg">
            📑 PowerPoint
          </div>
          <div className="nre-story-pulse-clock absolute bottom-4 left-1/2 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full border-2 border-dashed border-ink-muted/40 text-2xl">
            ⏱
          </div>
          <div className="nre-story-shake absolute right-8 bottom-10 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
            Again…
          </div>
        </div>
      );
    case "upload":
      return (
        <div className="nre-story-scene nre-story-scene--upload relative mx-auto h-[168px] w-full max-w-[300px]">
          <div className="absolute inset-x-6 bottom-6 top-10 rounded-xl border-2 border-dashed border-accent-orange/50 bg-accent-orange/5">
            <p className="pt-8 text-center text-[10px] font-medium uppercase tracking-wide text-accent-orange">
              Drop CSV here
            </p>
          </div>
          <div className="nre-story-csv-drop absolute left-1/2 top-0 flex -translate-x-1/2 flex-col items-center">
            <div className="rounded-md border border-emerald-500/40 bg-emerald-950/50 px-3 py-2 text-[11px] font-bold text-emerald-200 shadow-[0_8px_24px_rgba(16,185,129,0.25)]">
              meta_report.csv
            </div>
            <span className="mt-1 text-[9px] text-ink-muted">Meta · day-wise</span>
          </div>
        </div>
      );
    case "build":
      return (
        <div className="nre-story-scene nre-story-scene--build relative mx-auto h-[168px] w-full max-w-[300px]">
          <div className="absolute inset-x-8 top-8 h-1.5 overflow-hidden rounded-full bg-navy-border">
            <div className="nre-story-progress h-full rounded-full bg-accent-orange" />
          </div>
          <div className="absolute inset-x-6 bottom-4 flex justify-center gap-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`nre-story-slide-card nre-story-slide-card--${i} h-[88px] w-[72px] rounded-md border border-navy-border bg-navy-panel p-1.5 shadow-lg`}
              >
                <div className="h-2 w-8 rounded bg-accent-orange/60" />
                <div className="mt-2 grid grid-cols-2 gap-0.5">
                  <div className="h-3 rounded bg-navy-border/80" />
                  <div className="h-3 rounded bg-navy-border/80" />
                  <div className="h-3 rounded bg-navy-border/80" />
                  <div className="h-3 rounded bg-navy-border/80" />
                </div>
              </div>
            ))}
          </div>
          <div className="nre-story-sparkle pointer-events-none absolute right-10 top-12 text-lg">✦</div>
          <div className="nre-story-sparkle nre-story-sparkle--delay pointer-events-none absolute left-8 top-14 text-sm">✦</div>
        </div>
      );
    case "share":
      return (
        <div className="nre-story-scene nre-story-scene--share relative mx-auto flex h-[168px] w-full max-w-[300px] flex-col items-center justify-center gap-3">
          <div className="nre-story-pop flex items-center gap-3 rounded-xl border border-emerald-500/35 bg-emerald-950/30 px-4 py-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-orange/20 text-lg">📊</span>
            <div>
              <p className="text-[11px] font-bold text-white">Coastal Skin — Weekly</p>
              <p className="text-[9px] text-emerald-300/90">Ready to send</p>
            </div>
            <span className="nre-story-check ml-1 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-sm text-white">
              ✓
            </span>
          </div>
          <div className="flex flex-wrap justify-center gap-2 text-[9px] font-medium text-ink-secondary">
            <span className="rounded-full border border-navy-border bg-navy-panel px-2.5 py-1">.pptx</span>
            <span className="rounded-full border border-navy-border bg-navy-panel px-2.5 py-1">Live link</span>
            <span className="rounded-full border border-navy-border bg-navy-panel px-2.5 py-1">Drive</span>
          </div>
        </div>
      );
  }
}

/**
 * Short looping “video-style” explainer — pure CSS/HTML (no MP4). Screen-record this block for social if needed.
 */
export function NextReportStoryAnimation({ className = "" }: { className?: string }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const scene = SCENES[index];

  const goTo = useCallback((i: number) => {
    setIndex(i % SCENES.length);
  }, []);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % SCENES.length), SCENE_MS);
    return () => clearInterval(t);
  }, [paused]);

  return (
    <div className={`mx-auto w-full max-w-md ${className}`.trim()}>
      <div
        className="nre-keep-dark-surface nre-story-player relative overflow-hidden rounded-2xl border border-navy-border bg-[#0a1628] shadow-[0_24px_80px_-20px_rgba(0,0,0,0.65)]"
        aria-live="polite"
      >
        <div className="nre-story-gradient pointer-events-none absolute inset-0 opacity-80" aria-hidden="true" />

        <div className="relative px-5 pb-5 pt-4">
          <div className="flex items-center justify-between gap-2">
            <span className="rounded-full bg-navy-panel px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-orange">
              {scene.kicker}
            </span>
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              className="rounded-full border border-navy-border bg-navy-panel/80 px-2.5 py-0.5 text-[10px] font-medium text-ink-secondary hover:text-white"
              aria-pressed={paused}
            >
              {paused ? "Play" : "Pause"}
            </button>
          </div>

          <div key={scene.id} className="nre-story-text-enter mt-3 min-h-[4.5rem]">
            <h3 className="text-lg font-bold leading-snug text-white sm:text-xl">{scene.headline}</h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-secondary">{scene.sub}</p>
          </div>

          <div key={`vis-${scene.id}`} className="nre-story-visual-enter mt-4">
            <SceneVisual sceneId={scene.id} />
          </div>
        </div>

        <div className="relative border-t border-navy-border/80 bg-[#0d1b2e]/90 px-5 py-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[10px] text-ink-muted">
              {index + 1} / {SCENES.length}
            </span>
            <div className="flex flex-1 justify-center gap-1.5">
              {SCENES.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  aria-label={`Scene ${i + 1}: ${s.headline}`}
                  aria-current={i === index}
                  onClick={() => goTo(i)}
                  className={`h-1.5 rounded-full transition-all ${i === index ? "w-6 bg-accent-orange" : "w-1.5 bg-navy-border hover:bg-ink-muted"}`}
                />
              ))}
            </div>
            <span className="text-[10px] font-medium text-accent-orange/90">NextReport</span>
          </div>
        </div>
      </div>
    </div>
  );
}
