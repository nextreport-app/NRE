"use client";

import type { ReactNode } from "react";

/** Fixed bottom action bar on small screens; optional inline duplicate on md+. */
export function WizardStickyFooter({
  stepLabel,
  onBack,
  backLabel = "Back",
  primaryLabel,
  onPrimary,
  primaryDisabled,
  primaryLoading,
  primaryLoadingLabel = "Loading…",
  secondaryLabel,
  onSecondary,
  secondaryDisabled,
  showBack = true,
  extra,
}: {
  stepLabel?: string;
  onBack?: () => void;
  backLabel?: string;
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
  primaryLoadingLabel?: string;
  secondaryLabel?: string;
  onSecondary?: () => void;
  secondaryDisabled?: boolean;
  showBack?: boolean;
  extra?: ReactNode;
}) {
  return (
    <div className="nre-wizard-sticky-footer pointer-events-none fixed inset-x-0 bottom-0 z-40 border-t border-dash-border bg-dash-sidebar/95 px-4 py-3 backdrop-blur-sm md:hidden">
      <div className="pointer-events-auto mx-auto flex max-w-3xl items-center gap-3">
        {showBack && onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="shrink-0 rounded-md border border-dash-border px-3 py-2.5 text-[14px] font-medium text-dash-ink hover:bg-dash-border"
          >
            {backLabel}
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          {stepLabel ? (
            <p className="mb-1 truncate text-[12px] font-medium uppercase tracking-wide text-dash-ink-secondary">
              {stepLabel}
            </p>
          ) : null}
          <button
            type="button"
            onClick={onPrimary}
            disabled={primaryDisabled || primaryLoading}
            className="h-11 w-full rounded-md bg-dash-accent text-[15px] font-semibold text-dash-ink hover:bg-dash-accent-hover disabled:opacity-50"
          >
            {primaryLoading ? primaryLoadingLabel : primaryLabel}
          </button>
          {secondaryLabel && onSecondary ? (
            <button
              type="button"
              onClick={onSecondary}
              disabled={secondaryDisabled || primaryLoading}
              className="mt-2 h-10 w-full rounded-md border border-dash-border bg-dash-card text-[14px] font-medium text-dash-ink hover:bg-dash-sidebar disabled:opacity-50"
            >
              {secondaryLabel}
            </button>
          ) : null}
        </div>
        {extra}
      </div>
    </div>
  );
}
