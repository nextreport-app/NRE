"use client";

import { useId, useState } from "react";
import { META_WALKTHROUGH_PARTS } from "@/lib/meta-walkthrough-script";

/**
 * Compact step guide for silent walkthrough videos — opens from a control near the player.
 */
export function MetaWalkthroughStepGuide({
  className = "",
  variant = "dark",
}: {
  className?: string;
  /** `dark` for marketing pages; `dash` for wizard if reused later. */
  variant?: "dark" | "dash";
}) {
  const panelId = useId();
  const [open, setOpen] = useState(false);

  const isDark = variant === "dark";
  const triggerClass = isDark
    ? "border-navy-border bg-navy-panel/90 text-ink-secondary hover:border-accent-orange/40 hover:text-white"
    : "border-dash-border bg-dash-panel/90 text-dash-ink-secondary hover:text-dash-ink";
  const panelClass = isDark
    ? "border-navy-border bg-[#0f1a2e] text-ink-secondary shadow-2xl"
    : "border-dash-border bg-dash-popover nre-dash-surface text-dash-ink-secondary shadow-xl";

  return (
    <div className={`relative inline-flex ${className}`.trim()}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-accent-orange/50 ${triggerClass}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span
          className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-orange/15 text-[11px] font-bold text-accent-orange"
          aria-hidden="true"
        >
          ?
        </span>
        Step guide
        <span className="text-[10px] uppercase tracking-wide text-ink-muted">No audio needed</span>
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close step guide"
            className="fixed inset-0 z-40 cursor-default bg-black/40 sm:bg-transparent"
            onClick={() => setOpen(false)}
          />
          <div
            id={panelId}
            role="dialog"
            aria-label="Walkthrough step guide"
            className={`absolute right-0 top-[calc(100%+8px)] z-50 w-[min(22rem,calc(100vw-2rem))] rounded-xl border p-4 sm:w-[26rem] ${panelClass}`}
          >
            <p className="text-[13px] leading-relaxed text-ink-secondary">
              This video has no narration. Follow these steps in order as you watch — same flow as the recording.
            </p>
            <div className="mt-4 max-h-[min(22rem,55vh)] space-y-5 overflow-y-auto pr-1">
              {META_WALKTHROUGH_PARTS.map((part) => (
                <div key={part.id}>
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-accent-orange">{part.heading}</p>
                  <ol className="mt-2 space-y-2">
                    {part.steps.map((step, index) => (
                      <li key={step.title} className="flex gap-2.5 text-[12px] leading-snug">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-navy-panel text-[10px] font-bold text-accent-orange">
                          {index + 1}
                        </span>
                        <span>
                          <span className="font-semibold text-white">{step.title}</span>
                          <span className="text-ink-muted"> — {step.detail}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="mt-3 w-full rounded-md border border-navy-border py-1.5 text-xs font-medium text-ink-muted hover:bg-navy-panel hover:text-white"
              onClick={() => setOpen(false)}
            >
              Close
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
