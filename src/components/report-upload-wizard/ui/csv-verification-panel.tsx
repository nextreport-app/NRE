"use client";

import { useState } from "react";
import type { CsvVerificationResult } from "@/lib/nre/csv-report-reconciliation";
import { useWizardCopy } from "@/hooks/use-wizard-copy";
import { SupportTicketLink } from "@/components/support-ticket-link";
import { WhatsAppChatLink } from "@/components/whatsapp-chat-link";

type Props = {
  verification: CsvVerificationResult | null;
  refreshing?: boolean;
  clientId?: string;
  troubleshooting?: boolean;
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

export function CsvVerificationPanel({ verification, refreshing, clientId, troubleshooting }: Props) {
  const copy = useWizardCopy();
  const [open, setOpen] = useState(true);

  if (!verification) return null;

  if (verification.status === "skipped") {
    if (!verification.skipReason) return null;
    return (
      <div className="flex items-start gap-3 rounded-lg border border-dash-border bg-dash-bg/50 px-4 py-3">
        <span className="mt-0.5 text-[13px] text-dash-ink-muted" aria-hidden>
          ○
        </span>
        <div>
          <p className="text-[14px] font-medium text-dash-ink-secondary">CSV check not run</p>
          <p className="mt-0.5 text-[13px] leading-snug text-dash-ink-muted">{verification.skipReason}</p>
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

  if (ok) {
    const detailText = `Spend, results, and cost per result match your uploaded CSV for ${verifiedScopesLabel(verification.scopesVerified)} (every day in the weekly window must be present). Small spend rounding (about $2 either way) is ignored.`;
    return (
      <div className="nre-wizard-callout-success rounded-lg px-4 py-3">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-3 marker:content-none [&::-webkit-details-marker]:hidden">
            <span
              className="nre-wizard-callout-success__icon flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-900/50 text-[13px] text-emerald-200"
              aria-hidden
            >
              ✓
            </span>
            <span className="nre-wizard-callout-success__title min-w-0 flex-1 text-[14px] font-medium">
              Verified against your CSV
            </span>
            <span
              className="nre-wizard-callout-success__detail shrink-0 text-[15px] leading-none transition-transform group-open:rotate-180"
              aria-hidden
            >
              ▾
            </span>
          </summary>
          <p className="nre-wizard-callout-success__detail mt-2 border-t border-emerald-800/25 pt-2 pl-10 text-[13px] font-normal leading-snug">
            {detailText}
          </p>
        </details>
      </div>
    );
  }

  const whatsappHint = mismatches
    .slice(0, 3)
    .map((c) => `${c.scope}: ${c.metric} — deck ${c.reportDisplay} vs CSV ${c.csvDisplay}`)
    .join("; ");

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
          <p className="text-[13px] leading-snug text-dash-ink-secondary">
            {troubleshooting
              ? copy.csvTroubleshooting
              : verification.canAlignWithCsvExport
                ? copy.csvTroubleshootHintAlign
                : copy.csvTroubleshootHintRetry}
          </p>

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

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] font-medium">
            <SupportTicketLink
              clientId={clientId}
              openInNewTab
              className="nre-wizard-callout-warn__title underline hover:no-underline"
            />
            <span className="text-dash-ink-muted">·</span>
            <WhatsAppChatLink
              className="nre-wizard-callout-warn__title underline hover:no-underline"
              message={`Hi — my report preview doesn't match my CSV. ${whatsappHint}`}
            >
              Chat on WhatsApp
            </WhatsAppChatLink>
          </div>
        </div>
      ) : null}
    </div>
  );
}
