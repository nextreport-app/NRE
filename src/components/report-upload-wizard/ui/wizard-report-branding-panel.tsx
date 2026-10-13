"use client";

import Link from "next/link";
import {
  REPORT_BRANDING_MODE_LABELS,
  resolveShareBrandingDisplay,
  type ReportBrandingMode,
} from "@/lib/report-branding";

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
  const preview = resolveShareBrandingDisplay({
    mode: reportBrandingMode === "agency" && !trimmed ? "hidden" : reportBrandingMode,
    agencyName: trimmed || null,
  });

  const modes: ReportBrandingMode[] = ["agency", "hidden", "nextreport"];

  return (
    <section className="rounded-lg border border-l-4 border-l-[#f6ad55] border-dash-border bg-dash-card p-5">
      <h4 className="text-[16px] font-semibold text-dash-ink">Your name on this report</h4>
      <p className="mt-1 text-[13px] leading-relaxed text-dash-ink-secondary">
        Clients see this on the <strong className="font-medium text-dash-ink">cover slide</strong> (&quot;Prepared
        by…&quot;), <strong className="font-medium text-dash-ink">share link</strong>, PDF, and email — not buried in
        Account settings.
      </p>

      <label className="mt-4 block text-[13px] font-medium text-dash-ink-secondary">
        Agency or your name
        <input
          value={agencyName}
          onChange={(e) => onAgencyNameChange(e.target.value)}
          placeholder="e.g. Bright Path Marketing"
          maxLength={150}
          disabled={saving}
          className="mt-1.5 w-full rounded-md border border-dash-border bg-dash-sidebar px-3 py-2.5 text-[15px] text-dash-ink outline-none focus:border-dash-accent disabled:opacity-60"
        />
      </label>

      <fieldset className="mt-4">
        <legend className="sr-only">Branding on client-facing reports</legend>
        <div className="space-y-2">
          {modes.map((mode) => {
            const option = REPORT_BRANDING_MODE_LABELS[mode];
            const disabled = mode === "agency" && !trimmed;
            const recommended = mode === "agency";
            return (
              <label
                key={mode}
                className={`flex cursor-pointer gap-3 rounded-md border px-3 py-2.5 ${
                  reportBrandingMode === mode
                    ? "border-dash-accent bg-dash-accent/5"
                    : "border-dash-border bg-dash-sidebar/40"
                } ${disabled ? "cursor-not-allowed opacity-55" : ""}`}
              >
                <input
                  type="radio"
                  name="wizardReportBrandingMode"
                  value={mode}
                  checked={reportBrandingMode === mode}
                  disabled={disabled || saving}
                  onChange={() => onReportBrandingModeChange(mode)}
                  className="mt-0.5"
                />
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-medium text-dash-ink">{option.title}</span>
                    {recommended ? (
                      <span className="rounded-full bg-dash-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-dash-accent">
                        Recommended
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-[12px] leading-snug text-dash-ink-secondary">
                    {mode === "agency"
                      ? "Share link, PDF, and email show your name instead of NextReport."
                      : option.description}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-4 rounded-md border border-dash-border bg-dash-bg/80 px-3 py-2.5 text-[13px] text-dash-ink-secondary">
        <span className="font-medium text-dash-ink">Preview: </span>
        Cover — {trimmed ? `"Prepared by ${trimmed}"` : "no “Prepared by” line until you add a name"}
        {" · "}
        Share header — {preview.headerTitle ?? "minimal (no NextReport)"}
        {preview.footerPrimary ? ` · Footer — ${preview.footerPrimary}` : null}
      </div>

      {reportBrandingMode === "nextreport" ? (
        <p className="mt-3 rounded-md border border-amber-800/40 bg-amber-950/25 px-3 py-2 text-[13px] leading-relaxed text-amber-100">
          Clients will see <strong>NextReport</strong> on share links and PDFs. Most agencies choose &quot;Show my
          agency name&quot; above.
        </p>
      ) : null}

      {error ? <p className="mt-2 text-[13px] text-dash-error">{error}</p> : null}

      <p className="mt-3 text-[12px] text-dash-ink-muted">
        Optional agency logo and defaults for all future reports:{" "}
        <Link href="/account" target="_blank" rel="noopener noreferrer" className="text-dash-accent hover:underline">
          Account settings
        </Link>
        . Saved when you generate.
      </p>
    </section>
  );
}
