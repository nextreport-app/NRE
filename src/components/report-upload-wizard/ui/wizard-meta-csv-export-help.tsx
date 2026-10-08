"use client";

import { useId, useState } from "react";
import { META_CSV_IMPORT_TOOLTIP } from "@/lib/nre/meta-csv-export-guide";

/** Meta Import — compact CSV export hint (replaces the large Reports export panel). */
export function WizardMetaCsvImportTooltip() {
  const tooltipId = useId();
  const [open, setOpen] = useState(false);

  return (
    <span className="group/meta-tip relative inline-flex align-middle" onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-label="Meta CSV export tips"
        aria-expanded={open}
        aria-controls={tooltipId}
        className="ml-1.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-dash-border/80 text-[11px] font-semibold text-dash-ink-secondary hover:bg-dash-border/40 hover:text-white focus:outline-none focus:ring-2 focus:ring-dash-accent/60"
        onClick={() => setOpen((v) => !v)}
      >
        i
      </button>
      <div
        id={tooltipId}
        role="tooltip"
        className={`pointer-events-none absolute left-1/2 top-[calc(100%+6px)] z-30 w-[min(320px,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border border-dash-border bg-[#0a1628] px-3 py-2.5 text-left shadow-xl transition-opacity duration-150 ${
          open
            ? "pointer-events-auto opacity-100"
            : "opacity-0 [@media(hover:hover)]:group-hover/meta-tip:opacity-100"
        }`}
      >
        <p className="text-[12px] leading-snug text-dash-ink">{META_CSV_IMPORT_TOOLTIP.body}</p>
        <ul className="mt-2 list-inside list-disc space-y-0.5 text-[12px] text-dash-ink-secondary">
          {META_CSV_IMPORT_TOOLTIP.metrics.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </div>
    </span>
  );
}
