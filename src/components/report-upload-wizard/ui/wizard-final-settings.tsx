"use client";

import type { ReactNode } from "react";

export function WizardFinalSettings({ children, hasComparisons, previousMonthEnabled, previousMonthReady = false, hasCoverBudget = true, error }: {
  children: ReactNode;
  hasComparisons: boolean;
  previousMonthEnabled: boolean;
  previousMonthReady?: boolean;
  hasCoverBudget?: boolean;
  error?: string | null;
}) {
  const settingsLabel = [hasComparisons && "Comparisons", hasCoverBudget && "Cover budget", "Branding"].filter(Boolean).join(" · ");
  return <details open={!!error} className="group/settings rounded-lg border border-dash-border bg-dash-card">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 focus-visible:outline-2 focus-visible:outline-dash-accent [&::-webkit-details-marker]:hidden">
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-dash-ink">Optional settings</span>
        <span className="mt-1 block text-xs leading-relaxed text-dash-ink-secondary">{settingsLabel}{previousMonthEnabled ? previousMonthReady ? " · Previous-month totals on" : " · Previous-month upload needed" : ""}</span>
      </span>
      <span aria-hidden className="shrink-0 text-dash-ink-secondary transition-transform group-open/settings:rotate-180">⌄</span>
    </summary>
    {error && <p role="alert" className="px-4 pb-3 text-sm text-dash-error">{error}</p>}
    <div className="space-y-3 border-t border-dash-border p-4">{children}</div>
  </details>;
}
