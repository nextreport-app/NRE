"use client";

import { CurrencySelector } from "@/components/currency-selector";
import { usePricingCurrency } from "@/components/pricing-currency-provider";
import { PRICING_CURRENCY_NOTE, type PricingCurrency } from "@/lib/currency";

const REGION_HINT: Record<PricingCurrency, string> = {
  INR: "Showing Indian pricing — detected or selected for India.",
  USD: "Showing international pricing in US Dollars — detected or selected for your region.",
};

/** Pricing page currency line — synced with the header toggle and checkout. */
export function PricingCurrencyBanner() {
  const { currency, ready } = usePricingCurrency();

  return (
    <div className="mx-auto mt-8 flex max-w-xl flex-col items-center gap-3 rounded-xl border border-navy-border bg-navy-panel px-5 py-4">
      <p className="text-center text-sm text-ink-secondary">
        {ready ? REGION_HINT[currency] : "Detecting your region to show the right currency…"}
      </p>
      <CurrencySelector />
      <p className="text-center text-xs leading-relaxed text-ink-muted">{PRICING_CURRENCY_NOTE[currency]}</p>
      <p className="text-center text-[11px] text-ink-muted">
        Change anytime with the currency toggle here or in the site header — checkout uses the same selection.
      </p>
    </div>
  );
}
