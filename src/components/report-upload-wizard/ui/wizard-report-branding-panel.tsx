"use client";

import type { ReportBrandingMode } from "@/lib/report-branding";

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
  const useAgencyName = reportBrandingMode === "agency";

  return (
    <section className="rounded-lg border border-l-4 border-l-[#f6ad55] border-dash-border bg-dash-card p-4">
      <h4 className="text-[15px] font-semibold text-dash-ink">Your name on this report</h4>
      <p className="mt-0.5 text-[13px] text-dash-ink-secondary">
        Shown as &quot;Prepared by …&quot; on the cover slide.
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

      <label
        className={`mt-3 flex cursor-pointer items-start gap-2.5 ${!trimmed ? "cursor-not-allowed opacity-55" : ""}`}
      >
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
          checked={useAgencyName}
          disabled={!trimmed || saving}
          onChange={(e) => onReportBrandingModeChange(e.target.checked ? "agency" : "nextreport")}
        />
        <span className="text-[13px] leading-snug text-dash-ink-secondary">
          Use my name on the client share link and PDF instead of NextReport
        </span>
      </label>

      {error ? <p className="mt-2 text-[13px] text-dash-error">{error}</p> : null}
    </section>
  );
}
