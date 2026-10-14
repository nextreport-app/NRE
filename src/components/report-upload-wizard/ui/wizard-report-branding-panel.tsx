"use client";

import { useState } from "react";
import Link from "next/link";
import {
  REPORT_BRANDING_MODE_LABELS,
  type ReportBrandingMode,
} from "@/lib/report-branding";
import {
  markReportBrandingWizardCollapsed,
  reportBrandingWizardSummary,
  shouldExpandReportBrandingWizard,
} from "@/lib/report-branding-wizard-ui";

const SHARE_LINK_MODES: ReportBrandingMode[] = ["nextreport", "agency", "hidden"];

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
  showAgencyNameOnCover,
  onShowAgencyNameOnCoverChange,
  reportBrandingMode,
  onReportBrandingModeChange,
  initialReportBrandingMode,
  initialAgencyName,
  initialShowAgencyNameOnCover,
  saving,
  error,
}: {
  agencyName: string;
  onAgencyNameChange: (value: string) => void;
  showAgencyNameOnCover: boolean;
  onShowAgencyNameOnCoverChange: (show: boolean) => void;
  reportBrandingMode: ReportBrandingMode;
  onReportBrandingModeChange: (mode: ReportBrandingMode) => void;
  initialReportBrandingMode: ReportBrandingMode;
  initialAgencyName: string | null;
  initialShowAgencyNameOnCover: boolean;
  saving?: boolean;
  error?: string | null;
}) {
  const trimmed = agencyName.trim();
  const [expanded, setExpanded] = useState(() =>
    shouldExpandReportBrandingWizard({
      initialReportBrandingMode,
      initialAgencyName,
      initialShowAgencyNameOnCover,
    }),
  );

  const summary = reportBrandingWizardSummary({
    reportBrandingMode,
    agencyName,
    showAgencyNameOnCover,
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
              Every report is a <span className="text-dash-ink">PowerPoint file</span> and a{" "}
              <span className="text-dash-ink">browser share link</span>. Defaults use NextReport until you change
              settings here or in Account.
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
              Optional &quot;Prepared by …&quot; line on the first slide of the downloaded deck.
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

            <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-[13px] text-dash-ink-secondary">
              <input
                type="checkbox"
                checked={!showAgencyNameOnCover}
                disabled={saving || !trimmed}
                onChange={(e) => onShowAgencyNameOnCoverChange(!e.target.checked)}
                className="mt-0.5 shrink-0"
              />
              <span>Hide name on the cover slide {trimmed ? "" : "(add a name first)"}</span>
            </label>
          </div>

          <div className="rounded-lg border border-dash-border bg-dash-bg/40 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <DeliveryBadge>Link</DeliveryBadge>
              <h5 className="text-[14px] font-semibold text-dash-ink">Browser share link</h5>
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-dash-ink-secondary">
              How the live client page looks when you share the report URL (header, footer, and emails).
            </p>

            <fieldset className="mt-3">
              <legend className="sr-only">Share link branding</legend>
              <div className="space-y-2">
                {SHARE_LINK_MODES.map((mode) => {
                  const option = REPORT_BRANDING_MODE_LABELS[mode];
                  const disabled = mode === "agency" && !trimmed;
                  return (
                    <label
                      key={mode}
                      className={`flex cursor-pointer gap-2.5 rounded-md border px-3 py-2.5 ${
                        reportBrandingMode === mode
                          ? "border-dash-accent bg-dash-accent/5"
                          : "border-dash-border bg-dash-sidebar/30"
                      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
                    >
                      <input
                        type="radio"
                        name="wizardShareBranding"
                        checked={reportBrandingMode === mode}
                        disabled={disabled || saving}
                        onChange={() => onReportBrandingModeChange(mode)}
                        className="mt-0.5 shrink-0"
                      />
                      <span className="min-w-0">
                        <span className="text-[13px] font-medium text-dash-ink">{option.title}</span>
                        {mode === "nextreport" ? (
                          <span className="ml-1.5 text-[11px] font-medium text-dash-ink-muted">(default)</span>
                        ) : null}
                        <span className="mt-0.5 block text-[12px] leading-snug text-dash-ink-muted">
                          {option.description}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <p className="text-[13px] text-dash-ink-secondary">
              <Link href="/account" className="font-medium text-dash-accent hover:underline">
                Account settings
              </Link>
              {" — "}
              agency logo and the same options anytime.
            </p>
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
