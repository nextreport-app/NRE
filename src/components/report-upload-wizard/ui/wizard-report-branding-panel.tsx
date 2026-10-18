"use client";

import { useState } from "react";
import Link from "next/link";
import type { ReportBrandingMode } from "@/lib/report-branding";
import { markReportBrandingWizardCollapsed, reportBrandingWizardSummary } from "@/lib/report-branding-wizard-ui";

const WIZARD_SHARE_LINK_OPTIONS: { mode: ReportBrandingMode; label: string }[] = [
  { mode: "nextreport", label: "NextReport branding (default)" },
  { mode: "agency", label: "Show my or agency name" },
  { mode: "hidden", label: "Hide — don't show any name" },
];

function DeliveryBadge({ children }: { children: string }) {
  return (
    <span className="inline-flex shrink-0 rounded-md bg-dash-accent/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-dash-accent">
      {children}
    </span>
  );
}

export function WizardReportBrandingPanel({
  agencyName,
  onAgencyNameChange,
  reportBrandingMode,
  onReportBrandingModeChange,
  saving,
  error,
}: {
  agencyName: string;
  onAgencyNameChange: (value: string) => void;
  reportBrandingMode: ReportBrandingMode;
  onReportBrandingModeChange: (mode: ReportBrandingMode) => void;
  saving?: boolean;
  error?: string | null;
}) {
  const trimmed = agencyName.trim();
  const [expanded, setExpanded] = useState(false);

  const summary = reportBrandingWizardSummary({
    reportBrandingMode,
    agencyName,
  });

  function collapseSection() {
    markReportBrandingWizardCollapsed();
    setExpanded(false);
  }

  return (
    <section className="rounded-lg border border-dash-border bg-dash-card">
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        aria-expanded={expanded}
        className="flex w-full items-start justify-between gap-3 p-4 text-left"
      >
        <div className="min-w-0">
          <h4 className="text-[15px] font-semibold text-dash-ink">Report white-label</h4>
          {!expanded ? (
            <p className="mt-1 text-[13px] leading-snug text-dash-ink-secondary">{summary}</p>
          ) : (
            <p className="mt-1 text-[13px] leading-snug text-dash-ink-secondary">
              Default: no name on the PowerPoint cover and NextReport branding on the share link. Add a name only if
              you want white-label delivery.
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
        <div className="space-y-4 border-t border-dash-border px-4 pb-4 pt-3">
          <div className="rounded-lg border border-dash-border bg-dash-bg/40 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <DeliveryBadge>PPT</DeliveryBadge>
              <h5 className="text-[14px] font-semibold text-dash-ink">PowerPoint cover slide</h5>
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-dash-ink-secondary">
              Optional &quot;Prepared by …&quot; line on the first slide of the deck.
            </p>

            <label className="mt-3 block text-[13px] font-medium text-dash-ink-secondary">
              Agency or your name
              <input
                value={agencyName}
                onChange={(e) => onAgencyNameChange(e.target.value)}
                placeholder="e.g. Bright Path Marketing"
                maxLength={150}
                disabled={saving}
                className="mt-1 w-full rounded-md border border-dash-border bg-dash-sidebar px-3 py-2 text-[15px] text-dash-ink outline-none focus:border-dash-accent disabled:opacity-60"
              />
            </label>
            <p className="mt-2 text-[12px] leading-snug text-dash-ink-muted">
              {trimmed
                ? `Appears as "Prepared by ${trimmed}" on the cover. Clear the field to omit it.`
                : "Leave blank to omit \"Prepared by\" on the cover."}
            </p>
          </div>

          <div className="rounded-lg border border-dash-border bg-dash-bg/40 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <DeliveryBadge>Link</DeliveryBadge>
              <h5 className="text-[14px] font-semibold text-dash-ink">Browser share link</h5>
            </div>
            <label className="mt-3 block text-[13px] font-medium text-dash-ink-secondary">
              Branding on the client page
              <select
                value={reportBrandingMode}
                disabled={saving}
                onChange={(e) => onReportBrandingModeChange(e.target.value as ReportBrandingMode)}
                className="mt-1 w-full rounded-md border border-dash-border bg-dash-sidebar px-3 py-2 text-[15px] text-dash-ink outline-none focus:border-dash-accent disabled:opacity-60"
              >
                {WIZARD_SHARE_LINK_OPTIONS.map((opt) => {
                  const disabled = opt.mode === "agency" && !trimmed;
                  return (
                    <option key={opt.mode} value={opt.mode} disabled={disabled}>
                      {opt.label}
                    </option>
                  );
                })}
              </select>
            </label>
            {reportBrandingMode === "agency" && !trimmed ? (
              <p className="mt-1 text-[12px] text-dash-ink-muted">Add your agency name above to use white-label on the link.</p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <Link
              href="/account"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[13px] font-medium text-dash-accent hover:underline"
            >
              Account settings
            </Link>
            <button
              type="button"
              onClick={collapseSection}
              className="rounded-md border border-dash-border px-3 py-1.5 text-[13px] font-medium text-dash-ink-secondary hover:bg-dash-border/40"
            >
              Collapse
            </button>
          </div>

          {error ? <p className="text-[13px] text-dash-error">{error}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
