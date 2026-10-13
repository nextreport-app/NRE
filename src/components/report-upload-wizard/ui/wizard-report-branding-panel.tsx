"use client";

import type { ReportBrandingMode } from "@/lib/report-branding";

const SHARE_LINK_OPTIONS: {
  mode: ReportBrandingMode;
  title: string;
  detail: string;
  recommended?: boolean;
  requiresName?: boolean;
}[] = [
  {
    mode: "agency",
    title: "White-label link",
    detail: "Your name on the share link (not NextReport)",
    recommended: true,
    requiresName: true,
  },
  {
    mode: "hidden",
    title: "No names on link",
    detail: "Plain link — no NextReport, no agency name",
  },
  {
    mode: "nextreport",
    title: "NextReport on link",
    detail: "NextReport in the link header and footer",
  },
];

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

  return (
    <section className="rounded-lg border border-l-4 border-l-[#f6ad55] border-dash-border bg-dash-card p-4">
      <h4 className="text-[15px] font-semibold text-dash-ink">White-label &amp; your name</h4>
      <p className="mt-1 text-[13px] leading-snug text-dash-ink-secondary">
        <span className="text-dash-ink">PowerPoint cover</span> — &quot;Prepared by …&quot; when you add a name below.{" "}
        <span className="text-dash-ink">Share link</span> — pick one option (PDF export uses the same branding).
      </p>

      <label className="mt-3 block text-[13px] font-medium text-dash-ink-secondary">
        Your or agency name (cover slide)
        <input
          value={agencyName}
          onChange={(e) => onAgencyNameChange(e.target.value)}
          placeholder="e.g. Bright Path Marketing"
          maxLength={150}
          disabled={saving}
          className="mt-1 w-full rounded-md border border-dash-border bg-dash-sidebar px-3 py-2 text-[15px] text-dash-ink outline-none focus:border-dash-accent disabled:opacity-60"
        />
      </label>

      <fieldset className="mt-3">
        <legend className="mb-1.5 block text-[13px] font-medium text-dash-ink-secondary">Share link branding</legend>
        <div className="space-y-1.5">
          {SHARE_LINK_OPTIONS.map((opt) => {
            const disabled = Boolean(opt.requiresName && !trimmed);
            return (
              <label
                key={opt.mode}
                className={`flex cursor-pointer gap-2.5 rounded-md border px-3 py-2 ${
                  reportBrandingMode === opt.mode
                    ? "border-dash-accent bg-dash-accent/5"
                    : "border-dash-border bg-dash-sidebar/30"
                } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
              >
                <input
                  type="radio"
                  name="wizardShareBranding"
                  checked={reportBrandingMode === opt.mode}
                  disabled={disabled || saving}
                  onChange={() => onReportBrandingModeChange(opt.mode)}
                  className="mt-0.5 shrink-0"
                />
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[13px] font-medium text-dash-ink">{opt.title}</span>
                    {opt.recommended ? (
                      <span className="rounded bg-dash-accent/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-dash-accent">
                        Recommended
                      </span>
                    ) : null}
                  </span>
                  <span className="block text-[12px] leading-snug text-dash-ink-muted">{opt.detail}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {error ? <p className="mt-2 text-[13px] text-dash-error">{error}</p> : null}
    </section>
  );
}
