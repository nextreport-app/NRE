"use client";

import { useEffect, useState } from "react";

const SLIDE_BG = "#0d1b2e";
const ACCENT = "#f6ad55";

interface ExplainerFrame {
  step: string;
  title: string;
  caption: string;
  /** Caption doubles as a voiceover script when you record a marketing video. */
  voiceoverScript: string;
}

const FRAMES: ExplainerFrame[] = [
  {
    step: "1 / 5",
    title: "Add your ad data",
    caption: "Connect Meta, Google, TikTok, or GA4 via official API — or upload a CSV export.",
    voiceoverScript:
      "Start by connecting your ad account through the official API, or upload a CSV export. NextReport supports Meta, Google Ads, TikTok, and GA4.",
  },
  {
    step: "2 / 5",
    title: "Select campaigns",
    caption: "Pick the campaigns and ad sets that belong in this client's deck.",
    voiceoverScript:
      "Choose exactly which campaigns and ad sets to include. Everything unchecked stays out of the report.",
  },
  {
    step: "3 / 5",
    title: "Confirm objectives",
    caption: "The engine detects leads, purchases, traffic, and reach — you confirm or correct.",
    voiceoverScript:
      "NextReport auto-detects each campaign's objective. A quick review here keeps every metric card accurate.",
  },
  {
    step: "4 / 5",
    title: "Review metric cards",
    caption: "Preview the KPI chips on each slide. Add or remove metrics before you generate.",
    voiceoverScript:
      "Preview the metric cards that will appear on each slide. Add or remove KPIs with a single click.",
  },
  {
    step: "5 / 5",
    title: "Generate & share",
    caption: "Download .pptx, share a live link, export PDF, or save to Google Drive — under 2 minutes.",
    voiceoverScript:
      "Hit generate and deliver a branded PowerPoint, live browser link, or PDF — often in under two minutes.",
  },
];

function MockWizardPanel({ frameIndex }: { frameIndex: number }) {
  const panels = [
    <div key="upload" className="space-y-2">
      <div className="rounded border border-dashed border-navy-border p-3 text-center text-[10px] text-ink-muted">
        Sync from API or drop CSV
      </div>
      <div className="flex gap-1.5">
        {["Meta", "Google", "TikTok", "GA4"].map((p) => (
          <span key={p} className="rounded bg-navy-panel px-2 py-0.5 text-[9px] text-ink-secondary">
            {p}
          </span>
        ))}
      </div>
    </div>,
    <div key="campaigns" className="space-y-1.5">
      {["Lead Gen — Coastal Skin", "Retargeting — Summer Sale", "Brand Awareness"].map((c, i) => (
        <label key={c} className="flex items-center gap-2 text-[10px] text-ink-secondary">
          <input type="checkbox" readOnly checked={i < 2} className="accent-orange-400" />
          {c}
        </label>
      ))}
    </div>,
    <div key="objectives" className="space-y-1.5">
      {[
        { name: "Lead Gen", obj: "Leads", conf: "high" },
        { name: "Retargeting", obj: "Purchases", conf: "high" },
      ].map((row) => (
        <div key={row.name} className="flex items-center justify-between rounded bg-navy-panel px-2 py-1 text-[10px]">
          <span className="text-white">{row.name}</span>
          <span className="text-accent-orange">{row.obj}</span>
        </div>
      ))}
    </div>,
    <div key="metrics" className="flex flex-wrap gap-1">
      {["Ad Spend", "Leads", "CPL", "Reach", "CTR", "Impr."].map((m) => (
        <span key={m} className="rounded-full border border-accent-orange/40 px-2 py-0.5 text-[9px] text-white">
          {m}
        </span>
      ))}
    </div>,
    <div key="generate" className="space-y-2">
      <div className="rounded bg-accent-orange/20 px-2 py-1 text-[10px] font-semibold text-accent-orange">
        Weekly Performance Report · Last 7 days
      </div>
      <div className="grid grid-cols-2 gap-1">
        {["Download .pptx", "Live link", "Export PDF", "Google Drive"].map((action) => (
          <span key={action} className="rounded bg-navy-panel px-2 py-1 text-center text-[9px] text-ink-secondary">
            {action}
          </span>
        ))}
      </div>
    </div>,
  ];

  return (
    <div className="min-h-[140px] transition-opacity duration-500" style={{ opacity: 1 }}>
      {panels[frameIndex]}
    </div>
  );
}

/** Auto-cycling wizard walkthrough — pure HTML/CSS mock UI, no video file required. */
export function ProductExplainerAnimation() {
  const [index, setIndex] = useState(0);
  const frame = FRAMES[index];

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % FRAMES.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="mx-auto w-full max-w-lg">
      <div
        className="rounded-xl border border-navy-border p-5 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6)]"
        style={{ background: SLIDE_BG }}
        aria-live="polite"
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-medium uppercase tracking-wide text-ink-muted">Report wizard</span>
          <span className="text-[10px] text-accent-orange">{frame.step}</span>
        </div>
        <h3 className="mt-2 text-base font-semibold text-white">{frame.title}</h3>
        <div className="mt-4">
          <MockWizardPanel frameIndex={index} />
        </div>
        <p className="mt-4 text-xs leading-relaxed text-ink-secondary">{frame.caption}</p>
      </div>

      <div className="mt-4 flex items-center justify-center gap-2">
        {FRAMES.map((f, i) => (
          <button
            key={f.title}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Show step ${i + 1}: ${f.title}`}
            aria-current={i === index}
            className="h-2 w-2 rounded-full transition-colors"
            style={{ background: i === index ? ACCENT : "#1e3a5f" }}
          />
        ))}
      </div>
    </div>
  );
}
