"use client";

import { useState } from "react";
import Link from "next/link";
import { clientMonthlyBudgetSettingsHref } from "@/lib/nre/client-settings-navigation";

function ClientSettingsLink({ clientId, hasBudget }: { clientId: string; hasBudget: boolean }) {
  const href = clientMonthlyBudgetSettingsHref(clientId, { returnToWizard: true });
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-dash-accent hover:underline"
    >
      {hasBudget ? "Edit monthly budget" : "Set monthly budget"} in Client Settings
    </Link>
  );
}

export function WizardCoverBudgetSection({
  clientId,
  clientMonthlyBudget,
  coverBudgetPreviewLine,
  showBudgetOnCover,
  onShowBudgetOnCoverChange,
  coverBudgetPacingWarning,
  budgetToggleSaving,
  previewReady,
}: {
  clientId: string;
  clientMonthlyBudget: number | null;
  coverBudgetPreviewLine: string | null;
  showBudgetOnCover: boolean;
  onShowBudgetOnCoverChange: (checked: boolean) => void;
  coverBudgetPacingWarning: string | null;
  budgetToggleSaving: boolean;
  previewReady: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasBudget = clientMonthlyBudget != null && clientMonthlyBudget > 0;

  const summary = hasBudget
    ? coverBudgetPreviewLine
      ? `${coverBudgetPreviewLine}${showBudgetOnCover ? " · Shown on cover" : " · Hidden on cover"}`
      : "Monthly budget set · open to view pacing"
    : "No monthly budget set for this client";

  return (
    <section className="rounded-lg border border-dash-border bg-dash-card">
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        aria-expanded={expanded}
        className="flex w-full items-start justify-between gap-3 p-4 text-left"
      >
        <div className="min-w-0">
          <h4 className="text-[15px] font-semibold text-dash-ink">Cover slide budget</h4>
          {!expanded ? (
            <p className="mt-1 text-[13px] leading-snug text-dash-ink-secondary">{summary}</p>
          ) : null}
        </div>
        <span
          className={`mt-0.5 shrink-0 text-[15px] leading-none text-dash-ink-secondary transition-transform${expanded ? " rotate-180" : ""}`}
          aria-hidden
        >
          ▾
        </span>
      </button>

      {expanded ? (
        <div className="border-t border-dash-border px-4 pb-4 pt-3">
          {hasBudget ? (
            <div className="space-y-3 rounded-lg border border-dash-border nre-wizard-panel p-4">
              {coverBudgetPreviewLine ? (
                <p className="rounded-md border border-dash-border bg-dash-bg/80 px-4 py-3 text-[14px] leading-relaxed text-dash-ink">
                  {coverBudgetPreviewLine}
                </p>
              ) : (
                <p className="rounded-md border border-dash-border bg-dash-bg/60 px-4 py-3 text-[14px] text-dash-ink-secondary">
                  Calculating spend vs budget…
                </p>
              )}
              <label
                className={`flex items-start gap-3 ${budgetToggleSaving || !previewReady ? "cursor-wait" : "cursor-pointer"}`}
              >
                <input
                  type="checkbox"
                  checked={showBudgetOnCover}
                  disabled={budgetToggleSaving || !previewReady}
                  onChange={(e) => void onShowBudgetOnCoverChange(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-accent disabled:opacity-50"
                />
                <span className="text-[14px] leading-snug text-dash-ink-secondary">
                  Show monthly budget used on cover slide
                </span>
              </label>
              {showBudgetOnCover && coverBudgetPacingWarning ? (
                <p className="rounded-md border border-amber-800/50 bg-amber-950/30 px-4 py-3 text-[14px] leading-relaxed text-amber-200">
                  {coverBudgetPacingWarning}
                </p>
              ) : null}
              <p className="text-[13px] leading-relaxed text-dash-ink-secondary">
                <ClientSettingsLink clientId={clientId} hasBudget />
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[14px] leading-relaxed text-dash-ink-secondary">
                No monthly budget set for this client.
              </p>
              <p className="text-[13px] leading-relaxed text-dash-ink-secondary">
                <ClientSettingsLink clientId={clientId} hasBudget={false} />
              </p>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
