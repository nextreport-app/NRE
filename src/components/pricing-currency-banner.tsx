"use client";

import { CurrencySelector } from "@/components/currency-selector";

/** Compact currency control; billing details appear once below the plans. */
export function PricingCurrencyBanner() {
  return (
    <div className="mx-auto my-6 flex items-center justify-center gap-3">
      <span className="text-xs text-ink-muted">Currency</span>
      <CurrencySelector />
    </div>
  );
}
