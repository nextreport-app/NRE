"use client";

import Link from "next/link";
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
  const warnings = guidance.warnings;
  if (warnings.length === 0) return null;

  const isAmberKind = (kind: string) =>
    kind === "missing_month_start" ||
    kind === "first_of_month" ||
    kind === "missing_reach_values" ||
    kind === "missing_metric_values";

  const primary = warnings[0]!;
  const borderClass = isAmberKind(primary.kind)
    ? "border-[#f6ad55]/50 border-l-[#f6ad55]"
    : "border-dash-accent/40 border-l-dash-accent";
  const showRedownload = warnings.some((w) => w.kind === "missing_month_start" || w.kind === "first_of_month");

  return (
    <div className={`space-y-3 rounded-lg border border-l-4 bg-dash-card nre-dash-surface p-4 ${borderClass}`}>
      <div className="space-y-3">
        {warnings.map((warning, index) => (
          <div key={`${warning.kind}-${index}`} className={index > 0 ? "border-t border-dash-border/60 pt-3" : "space-y-1.5"}>
            <p className="text-[15px] font-semibold leading-snug text-dash-ink">{warning.title}</p>
            <p className="text-[14px] leading-relaxed text-dash-ink-secondary">{warning.message}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={onContinue}
          className="rounded-md bg-dash-accent px-4 py-2 text-[14px] font-semibold text-dash-ink hover:bg-dash-accent-hover"
        >
          {showRedownload ? "Continue anyway →" : "Generate anyway →"}
        </button>
        {showRedownload ? (
          <button
            type="button"
            onClick={onRedownload}
            className="rounded-md border border-dash-border px-4 py-2 text-[14px] font-medium text-dash-ink hover:bg-dash-border"
          >
            I&apos;ll re-download
          </button>
        ) : (
          <Link
            href="/help/download"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-md border border-dash-border px-4 py-2 text-[14px] font-medium text-dash-ink hover:bg-dash-border"
          >
            CSV export guide
          </Link>
        )}
      </div>
    </div>
  );
}
