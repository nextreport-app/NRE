"use client";

import { useId, useState } from "react";
import { META_WALKTHROUGH_QUICK_GUIDE } from "@/lib/meta-walkthrough-script";

/** Minimal step list beside the walkthrough video. */
export function MetaWalkthroughStepGuide({
  className = "",
  variant = "dark",
}: {
  className?: string;
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
        Step guide
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
            className={`absolute right-0 top-[calc(100%+8px)] z-50 w-[min(18rem,calc(100vw-2rem))] rounded-xl border p-4 sm:w-[20rem] ${panelClass}`}
          >
            <div className="space-y-4">
              {META_WALKTHROUGH_QUICK_GUIDE.map((part) => (
                <div key={part.label}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-accent-orange">{part.label}</p>
                  <ul className="mt-1.5 space-y-1 text-[13px] leading-snug text-white">
                    {part.steps.map((step) => (
                      <li key={step} className="flex gap-2">
                        <span className="text-accent-orange" aria-hidden="true">
                          ·
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="mt-4 w-full rounded-md border border-navy-border py-1.5 text-xs font-medium text-ink-muted hover:bg-navy-panel hover:text-white"
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
