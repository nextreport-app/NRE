"use client";

import type { CsvDateWarning } from "@/lib/nre/csv-date-guidance";

export function CsvZeroMetricBanner({
  warnings,
  onDismiss,
}: {
  warnings: CsvDateWarning[];
  onDismiss: () => void;
}) {
  const warning = warnings[0];
  if (!warning) return null;

  return (
    <div className="space-y-3 rounded-lg border border-l-4 border-[#f6ad55]/50 border-l-[#f6ad55] bg-dash-card nre-dash-surface p-4">
      <div className="space-y-1.5">
        <p className="text-[15px] font-semibold leading-snug text-dash-ink">{warning.title}</p>
        <p className="text-[14px] leading-relaxed text-dash-ink-secondary">{warning.message}</p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="rounded-md bg-dash-accent px-4 py-2 text-[14px] font-semibold text-dash-ink hover:bg-dash-accent-hover"
      >
        Generate anyway →
      </button>
    </div>
  );
}
