"use client";

import { useState } from "react";
import type { CsvVerificationResult } from "@/lib/nre/csv-report-reconciliation";

type Props = {
  verification: CsvVerificationResult | null;
  refreshing?: boolean;
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

export function CsvVerificationPanel({ verification, refreshing }: Props) {
  const [open, setOpen] = useState(false);

  if (!verification || verification.status === "skipped") return null;

  if (refreshing && verification.checks.length === 0) {
    return <p className="text-[13px] text-dash-ink-secondary">Checking spend and results against your CSV…</p>;
  }

  const ok = verification.status === "ok";
  const mismatches = verification.checks.filter((c) => c.status === "mismatch");
  const byScope = groupByScope(verification.checks);

  return (
    <div
      className={`rounded-lg border px-4 py-3.5 ${
        ok ? "border-emerald-800/35 bg-emerald-950/15" : "border-amber-800/35 bg-amber-950/10"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 text-left"
        aria-expanded={open}
      >
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] ${
            ok ? "bg-emerald-900/50 text-emerald-200" : "bg-amber-900/40 text-amber-100"
          }`}
          aria-hidden
        >
          {ok ? "✓" : "!"}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block text-[14px] font-medium ${ok ? "text-emerald-100" : "text-amber-50"}`}>
            {ok ? "Verified against your CSV" : `${mismatches.length} mismatch${mismatches.length === 1 ? "" : "es"} vs your CSV`}
          </span>
          <span className="mt-0.5 block text-[12px] text-dash-ink-muted">
            Amount spent, results, and cost per result only · does not block generate
          </span>
        </span>
        <span className="shrink-0 text-[12px] text-dash-ink-secondary">{open ? "Hide" : "Details"}</span>
      </button>

      {verification.alignedWithCsvExport ? (
        <p className="mt-3 border-t border-dash-border/30 pt-3 text-[12px] leading-relaxed text-amber-100/90">
          Totals were adjusted once to match your export columns. Generate uses the same counting.
        </p>
      ) : null}

      {open ? (
        <div className="mt-3 space-y-4 border-t border-dash-border/30 pt-3">
          {[...byScope.entries()].map(([scope, scopeChecks]) => (
            <div key={scope}>
              <p className="text-[12px] font-medium uppercase tracking-wide text-dash-ink-muted">{scope}</p>
              <dl className="mt-2 space-y-2">
                {scopeChecks.map((c) => (
                  <div
                    key={`${scope}-${c.metric}`}
                    className={`grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-0.5 text-[13px] ${
                      c.status === "mismatch" ? "text-amber-50" : "text-dash-ink-secondary"
                    }`}
                  >
                    <dt className="text-dash-ink-secondary">{c.metric}</dt>
                    <dd className="text-right text-white tabular-nums">{c.reportDisplay}</dd>
                    <dd className="text-right tabular-nums text-dash-ink-muted">
                      CSV {c.csvDisplay}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
