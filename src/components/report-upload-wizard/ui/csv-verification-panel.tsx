"use client";

import { useState } from "react";
import type { CsvVerificationResult } from "@/lib/nre/csv-report-reconciliation";
import { SupportTicketLink } from "@/components/support-ticket-link";
import { WhatsAppChatLink } from "@/components/whatsapp-chat-link";

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

function verifiedScopesLabel(scopes: string[] | undefined): string {
  if (!scopes?.length) return "key totals in this report";
  if (scopes.length <= 3) return scopes.join(" · ");
  return `${scopes.slice(0, 3).join(" · ")} +${scopes.length - 3} more`;
}

export function CsvVerificationPanel({ verification, refreshing, clientId }: Props) {
  const [open, setOpen] = useState(false);

  if (!verification) return null;

  if (verification.status === "skipped") {
    if (!verification.skipReason) return null;
    return (
      <div className="flex items-start gap-3 rounded-lg border border-dash-border bg-dash-bg/50 px-4 py-3">
        <span className="mt-0.5 text-[13px] text-dash-ink-muted" aria-hidden>
          ○
        </span>
        <div>
          <p className="text-[14px] font-medium text-dash-ink-secondary">CSV verification not run</p>
          <p className="mt-0.5 text-[13px] leading-snug text-dash-ink-muted">{verification.skipReason}</p>
        </div>
      </div>
    );
  }

  if (refreshing && verification.checks.length === 0) {
    return <p className="text-[13px] text-dash-ink-secondary">Checking spend and results against your CSV…</p>;
  }

  const ok = verification.status === "ok";
  const mismatches = verification.checks.filter((c) => c.status === "mismatch");
  const byScope = groupByScope(mismatches);

  if (ok) {
    const detailText = `Spend, results, and cost per result match for ${verifiedScopesLabel(verification.scopesVerified)}. Small spend rounding (about $2 either way) is ignored.`;
    return (
      <div className="rounded-lg border border-emerald-800/35 bg-emerald-950/15 px-4 py-3">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-3 marker:content-none [&::-webkit-details-marker]:hidden">
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-900/50 text-[13px] text-emerald-200"
              aria-hidden
            >
              ✓
            </span>
            <span className="min-w-0 flex-1 text-[14px] font-medium text-emerald-100">Verified against your CSV</span>
            <span
              className="shrink-0 text-[15px] leading-none text-emerald-100/70 transition-transform group-open:rotate-180"
              aria-hidden
            >
              ▾
            </span>
          </summary>
          <p className="mt-2 border-t border-emerald-800/25 pt-2 pl-10 text-[13px] font-normal leading-snug text-emerald-100/75">
            {detailText}
          </p>
        </details>
      </div>
    );
  }

  const whatsappHint = mismatches
    .slice(0, 3)
    .map((c) => `${c.scope}: ${c.metric} — report ${c.reportDisplay} vs CSV ${c.csvDisplay}`)
    .join("; ");

  return (
    <div className="rounded-lg border border-amber-800/35 bg-amber-950/10 px-4 py-3.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 text-left"
        aria-expanded={open}
      >
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-900/40 text-[13px] text-amber-100"
          aria-hidden
        >
          !
        </span>
        <span className="min-w-0 flex-1 text-[14px] font-medium text-amber-50">
          {mismatches.length} meaningful mismatch{mismatches.length === 1 ? "" : "es"} vs your CSV
        </span>
        <span
          className={`shrink-0 text-[15px] leading-none text-dash-ink-secondary transition-transform${open ? " rotate-180" : ""}`}
          aria-hidden
        >
          ▾
        </span>
      </button>

      {verification.canAlignWithCsvExport && !verification.alignedWithCsvExport ? (
        <p className="mt-3 border-t border-dash-border/30 pt-3 text-[12px] leading-relaxed text-amber-100/90">
          Results may match your export if you use CSV export counting — we turned that on automatically for this
          preview. Generate again if totals still look off.
        </p>
      ) : null}

      {verification.alignedWithCsvExport ? (
        <p className="mt-3 border-t border-dash-border/30 pt-3 text-[12px] leading-relaxed text-amber-100/90">
          Totals use CSV export counting. Generate uses the same rules.
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
                    className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-0.5 text-[13px] text-amber-50"
                  >
                    <dt className="text-dash-ink-secondary">{c.metric}</dt>
                    <dd className="text-right text-white tabular-nums">{c.reportDisplay}</dd>
                    <dd className="text-right tabular-nums text-dash-ink-muted">CSV {c.csvDisplay}</dd>
                    {c.note ? (
                      <dd className="col-span-3 text-[12px] leading-snug text-amber-100/80">{c.note}</dd>
                    ) : null}
                  </div>
                ))}
              </dl>
            </div>
          ))}
          <p className="text-[12px] leading-relaxed text-dash-ink-muted">
            You can still generate — this is a sanity check, not a block.
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px]">
            <SupportTicketLink clientId={clientId} openInNewTab className="text-amber-100" />
            <span className="text-dash-ink-muted">·</span>
            <WhatsAppChatLink
              className="font-medium text-amber-100 underline hover:no-underline"
              message={`Hi — CSV verification mismatch on my report. ${whatsappHint}`}
            >
              Chat on WhatsApp
            </WhatsAppChatLink>
          </div>
        </div>
      ) : null}
    </div>
  );
}
