"use client";

import { useState } from "react";
import type { CsvCoverageWarning, CsvVerificationResult } from "@/lib/nre/csv-report-reconciliation";
import { useWizardCopy } from "@/hooks/use-wizard-copy";
type Props = {
  verification: CsvVerificationResult | null;
  refreshing?: boolean;
  clientId?: string;
};

function groupByScope(checks: CsvVerificationResult["checks"]) {
  const map = new Map<string, typeof checks>();
  for (const c of checks) {
    const list = map.get(c.scope) ?? [];
    list.push(c);
    map.set(c.scope, list);
  }
  return map;
}

function DateCoverageNotice({ warnings }: { warnings: CsvCoverageWarning[] }) {
  if (!warnings.length) return null;
  return (
    <div className="nre-wizard-callout-warn rounded-lg px-4 py-3 text-[13px] leading-relaxed" role="status">
      <p className="nre-wizard-callout-warn__title font-medium">CSV date coverage to review</p>
      {warnings.map(warning => (
        <div key={warning.scope} className="nre-wizard-callout-warn__body mt-2">
          <p className="font-medium">{warning.scope}</p>
          <p>No CSV rows on: {warning.missingDays.join(", ")}.</p>
          <p>{warning.message}</p>
        </div>
      ))}
    </div>
  );
}

export function CsvVerificationPanel({ verification, refreshing }: Props) {
  const copy = useWizardCopy();
  const [open, setOpen] = useState(true);

  if (!verification) return null;

  if (verification.status === "skipped") {
    const reason = verification.skipReason?.trim() || copy.csvSkippedDefaultReason;
    return (
      <div className="nre-wizard-callout-neutral rounded-lg px-4 py-3.5" role="status">
        <div className="flex items-start gap-3">
          <span
            className="nre-wizard-callout-neutral__icon mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-700/50 text-[13px] font-semibold text-slate-200"
            aria-hidden
          >
            —
          </span>
          <div className="min-w-0 flex-1">
            <p className="nre-wizard-callout-neutral__title text-[14px] font-medium">{copy.csvSkippedTitle}</p>
            <p className="nre-wizard-callout-neutral__body mt-1 text-[13px] leading-snug">{copy.csvSkippedLead}</p>
            <p className="nre-wizard-callout-neutral__body mt-2 text-[13px] leading-snug">{reason}</p>
          </div>
        </div>
      </div>
    );
  }

  if (refreshing && verification.checks.length === 0) {
    return <p className="text-[13px] text-dash-ink-secondary">Comparing deck preview to your CSV…</p>;
  }

  const ok = verification.status === "ok";
  const mismatches = verification.checks.filter((c) => c.status === "mismatch");
  const byScope = groupByScope(mismatches);
  const coverageWarnings = verification.coverageWarnings ?? [];

  if (ok) {
    const tone = coverageWarnings.length ? "nre-wizard-callout-neutral" : "nre-wizard-callout-success";
    const textTone = coverageWarnings.length ? "nre-wizard-callout-neutral__body" : "nre-wizard-callout-success__detail";
    return (
      <div className="space-y-3">
        <DateCoverageNotice warnings={coverageWarnings} />
        <div className={`${tone} rounded-lg px-4 py-3 text-[13px] leading-relaxed`} role="status">
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-3 marker:content-none [&::-webkit-details-marker]:hidden">
              <span className={`${tone}__icon flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] ${coverageWarnings.length ? "bg-slate-700/30 text-dash-ink" : "bg-emerald-900/50 text-emerald-200"}`} aria-hidden="true">✓</span>
              <span className={`${tone}__title min-w-0 flex-1 text-[14px] font-medium`}>{copy.csvVerifiedTitle}</span>
              <span className={`${textTone} shrink-0 transition-transform group-open:rotate-180`} aria-hidden="true">▾</span>
            </summary>
            <p className={`${textTone} mt-3 border-t border-dash-border/30 pt-3`}>{copy.csvVerifiedDetail()}</p>
          </details>
        </div>
      </div>
    );
  }

  return (
    <div className="nre-wizard-callout-warn rounded-lg px-4 py-3.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 text-left"
        aria-expanded={open}
      >
        <span
          className="nre-wizard-callout-warn__icon flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-900/40 text-[13px] text-amber-100"
          aria-hidden
        >
          !
        </span>
        <span className="nre-wizard-callout-warn__title min-w-0 flex-1 text-[14px] font-medium">
          {copy.csvMismatchTitle(mismatches.length)}
        </span>
        <span
          className={`shrink-0 text-[15px] leading-none text-dash-ink-secondary transition-transform${open ? " rotate-180" : ""}`}
          aria-hidden
        >
          ▾
        </span>
      </button>

      {open ? (
        <div className="mt-3 space-y-4 border-t border-dash-border/30 pt-3">
          <p className="nre-wizard-callout-warn__body text-[13px] leading-relaxed">{copy.csvMismatchBody}</p>
          <DateCoverageNotice warnings={coverageWarnings} />

          {[...byScope.entries()].map(([scope, scopeChecks]) => (
            <div key={scope} className="rounded-md border border-dash-border/40 bg-dash-bg/30 px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-dash-ink-muted">{scope}</p>
              <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 gap-y-2 text-[12px]">
                <span className="text-dash-ink-muted">Metric</span>
                <span className="text-right text-dash-ink-muted">Deck preview</span>
                <span className="text-right text-dash-ink-muted">Your CSV</span>
                {scopeChecks.map((c) => (
                  <div key={`${scope}-${c.metric}`} className="contents">
                    <span className="text-dash-ink-secondary">{c.metric}</span>
                    <span className="text-right font-medium tabular-nums text-dash-ink">{c.reportDisplay}</span>
                    <span className="text-right tabular-nums text-dash-ink">{c.csvDisplay}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
