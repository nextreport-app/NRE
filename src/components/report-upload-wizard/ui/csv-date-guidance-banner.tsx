"use client";

import type { CsvDateGuidance } from "@/lib/nre/csv-date-guidance";

export function CsvDateGuidanceBanner({
  guidance,
  onContinue,
  onRedownload,
}: {
  guidance: CsvDateGuidance;
  onContinue: () => void;
  onRedownload: () => void;
}) {
  const warning = guidance.warnings[0];
  if (!warning) return null;

  const isExportGap = warning.kind === "missing_month_start" || warning.kind === "first_of_month";
  const borderClass = isExportGap
    ? "border-[#f6ad55]/50 border-l-[#f6ad55]"
    : "border-dash-accent/40 border-l-dash-accent";

  return (
    <div className={`space-y-3 rounded-lg border border-l-4 bg-[#1e293b] p-4 ${borderClass}`}>
      <div className="space-y-1.5">
        <p className="text-[15px] font-semibold leading-snug text-white">{warning.title}</p>
        <p className="text-[14px] leading-relaxed text-[#e2e8f0]">{warning.message}</p>
      </div>
      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={onContinue}
          className="rounded-md bg-dash-accent px-4 py-2 text-[14px] font-semibold text-dash-ink hover:bg-dash-accent-hover"
        >
          {isExportGap ? "Continue anyway →" : "Got it →"}
        </button>
        {isExportGap ? (
          <button
            type="button"
            onClick={onRedownload}
            className="rounded-md border border-dash-border px-4 py-2 text-[14px] font-medium text-dash-ink hover:bg-dash-border"
          >
            I&apos;ll re-download
          </button>
        ) : null}
      </div>
    </div>
  );
}
