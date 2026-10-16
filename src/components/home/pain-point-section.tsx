"use client";

import { useSiteCopy } from "@/hooks/use-site-copy";
import { MarketingSection, MarketingSectionHeader } from "./marketing-section";

export function PainPointSection() {
  const { home } = useSiteCopy();

  return (
    <MarketingSection band="default" className="border-t-4 border-accent-orange">
      <MarketingSectionHeader title={home.painTitle} subtitle={home.painBody} />

      <div className="mx-auto mt-12 grid max-w-4xl gap-5 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch sm:gap-4">
        <div className="nre-marketing-card p-6 text-left">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
            {home.painWithoutLabel}
          </p>
          <p className="mt-3 text-xl font-semibold tracking-tight text-white">{home.painWithoutCalc}</p>
          <p className="mt-2 text-sm font-medium text-red-400">{home.painWithoutResult}</p>
        </div>

        <div className="flex items-center justify-center sm:px-1">
          <span className="nre-marketing-vs-pill" aria-hidden="true">
            vs
          </span>
        </div>

        <div className="nre-marketing-card nre-marketing-card--highlight p-6 text-left">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
            {home.painWithLabel}
          </p>
          <p className="mt-3 text-xl font-semibold tracking-tight text-white">{home.painWithCalc}</p>
          <p className="mt-2 text-sm font-medium text-accent-orange">{home.painWithResult}</p>
        </div>
      </div>
    </MarketingSection>
  );
}
