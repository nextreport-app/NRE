"use client";

import { useState } from "react";
import Link from "next/link";
import type { ReportBrandingMode } from "@/lib/report-branding";
import { wizardUnifiedBrandingLines } from "@/lib/report-branding-wizard-ui";

function BrandingPreview({ reportBrandingMode, agencyName }: { reportBrandingMode: ReportBrandingMode; agencyName: string }) {
  const { line1, line2 } = wizardUnifiedBrandingLines(reportBrandingMode, agencyName);
  return (
    <div className="text-[13px] leading-relaxed text-dash-ink">
      <p>{line1}</p>
      <p className="mt-1">{line2}</p>
    </div>
  );
}

export function WizardReportBrandingPanel({
  agencyName,
  reportBrandingMode,
  error,
}: {
  agencyName: string;
  reportBrandingMode: ReportBrandingMode;
  error?: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const { line1 } = wizardUnifiedBrandingLines(reportBrandingMode, agencyName);

  return (
    <section className="rounded-lg border border-dash-border bg-dash-card">
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        aria-expanded={expanded}
        className="flex w-full items-start justify-between gap-3 p-4 text-left"
      >
        <div className="min-w-0">
          <h4 className="text-[15px] font-semibold text-dash-ink">Agency &amp; white-label branding</h4>
          {!expanded ? (
            <p className="mt-1 truncate text-[13px] text-dash-ink-secondary">{line1}</p>
          ) : (
            <p className="mt-1 text-[13px] leading-snug text-dash-ink-secondary">
              From your account settings — same credit on the deck, live link, and client emails.
            </p>
          )}
        </div>
        <span
          className={`mt-0.5 shrink-0 text-[15px] leading-none text-dash-ink-secondary transition-transform${expanded ? " rotate-180" : ""}`}
          aria-hidden
        >
          ▾
        </span>
      </button>

      {expanded ? (
        <div className="border-t border-dash-border px-4 pb-4 pt-3">
          <div className="rounded-lg border border-dash-border bg-dash-bg/40 p-4">
            <BrandingPreview reportBrandingMode={reportBrandingMode} agencyName={agencyName} />
          </div>

          {error ? <p className="mt-3 text-[13px] text-dash-error">{error}</p> : null}

          <p className="mt-4 text-[13px] text-dash-ink-secondary">
            <Link
              href="/account"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-dash-accent hover:underline"
            >
              Account settings
            </Link>{" "}
            opens in a new tab. When you return here, branding updates automatically — you stay on this step.
          </p>
        </div>
      ) : null}
    </section>
  );
}
