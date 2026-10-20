"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { MetaWalkthroughVideoCompact } from "@/components/meta-walkthrough-video";

/** Import step — optional Loom walkthrough (Meta only). */
export function WizardImportVideoPanel() {
  const panelId = useId();
  const [open, setOpen] = useState(true);

  return (
    <section className="rounded-lg border border-dash-border bg-dash-card p-4" aria-labelledby="wizard-import-video-heading">
      <button
        type="button"
        id="wizard-import-video-heading"
        className="flex w-full items-center justify-between gap-2 text-left"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-[14px] font-semibold text-dash-ink">Video: Meta CSV export → full wizard</span>
        <span className="text-[12px] font-medium text-dash-accent">{open ? "Hide" : "Show"}</span>
      </button>
      {open ? (
        <div id={panelId} className="mt-3 space-y-2">
          <MetaWalkthroughVideoCompact id="wizard-import-video-walkthrough" />
          <p className="text-[12px] text-dash-ink-secondary">
            <Link href="/help/download#video-walkthrough" target="_blank" rel="noopener noreferrer" className="text-dash-accent hover:underline">
              Open with step-by-step checklist
            </Link>
          </p>
        </div>
      ) : null}
    </section>
  );
}
