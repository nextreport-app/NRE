"use client";

import { useState } from "react";
import type { CsvVerificationResult } from "@/lib/nre/csv-report-reconciliation";

type Props = {
  verification: CsvVerificationResult | null;
  refreshing?: boolean;
};

export function CsvVerificationPanel({ verification, refreshing }: Props) {
  const [open, setOpen] = useState(false);

  if (!verification || verification.status === "skipped") return null;

  const mismatches = verification.checks.filter((c) => c.status === "mismatch");
  const ok = verification.status === "ok";

  if (refreshing && !verification.checks.length) {
    return (
      <p className="text-[13px] text-dash-ink-secondary">Checking totals against your CSV…</p>
    );
  }

  return (
    <div
      className={`rounded-lg border px-4 py-3 ${
        ok ? "border-emerald-900/40 bg-emerald-950/20" : "border-amber-900/40 bg-amber-950/15"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left"
        aria-expanded={open}
      >
        <span className={`text-[14px] font-medium ${ok ? "text-emerald-200" : "text-amber-100"}`}>
          {ok
            ? "Verified against your CSV"
            : `${mismatches.length} ${mismatches.length === 1 ? "difference" : "differences"} vs your CSV`}
        </span>
        <span className="text-[13px] text-dash-ink-secondary">{open ? "▴" : "▾"}</span>
      </button>

      {verification.alignedWithCsvExport && !ok ? (
        <p className="mt-2 text-[13px] leading-relaxed text-amber-200/90">
          We adjusted result counting to follow your export columns. If anything still looks off, contact support with
          this report&apos;s settings.
        </p>
      ) : null}

      {open ? (
        <ul className="mt-3 space-y-2 border-t border-dash-border/40 pt-3">
          {(ok ? verification.checks.slice(0, 4) : mismatches).map((c) => (
            <li key={`${c.scope}-${c.metric}`} className="text-[13px] leading-snug text-dash-ink-secondary">
              <span className="text-white">{c.metric}</span>
              <span className="text-dash-ink-muted"> · {c.scope}</span>
              <div className="mt-0.5">
                Report <span className="text-white">{c.reportDisplay}</span>
                {" · "}
                CSV <span className="text-white">{c.csvDisplay}</span>
              </div>
              {c.note ? <p className="mt-1 text-[12px] text-dash-ink-muted">{c.note}</p> : null}
            </li>
          ))}
          {ok && verification.checks.length > 4 ? (
            <li className="text-[12px] text-dash-ink-muted">+ {verification.checks.length - 4} more metrics match</li>
          ) : null}
          {!ok ? (
            <li className="pt-1 text-[12px] leading-relaxed text-dash-ink-muted">
              You can still generate — this is a sanity check, not a block. Re-uploading the same CSV usually reproduces
              the same numbers unless we auto-adjust (above).
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
