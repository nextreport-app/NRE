"use client";

import { PRICING_CURRENCY_LABELS, type PricingCurrency } from "@/lib/currency";
import { usePricingCurrencyOptional } from "@/components/pricing-currency-provider";

type CurrencySelectorProps = {
  /** Smaller padding for the header bar. */
  compact?: boolean;
  className?: string;
};

/**
 * INR / USD toggle — synced site-wide via PricingCurrencyProvider.
 * Renders nothing when used outside the provider (e.g. isolated tests).
 */
export function CurrencySelector({ compact = false, className = "" }: CurrencySelectorProps) {
  const ctx = usePricingCurrencyOptional();
  if (!ctx) return null;

  const { currency, setCurrency } = ctx;
  const pad = compact ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm";

  return (
    <div
      className={`flex items-center gap-0.5 rounded-full border border-navy-border bg-navy-panel p-0.5 ${className}`}
      role="group"
      aria-label="Display currency"
    >
      {(["INR", "USD"] as const).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setCurrency(code)}
          aria-pressed={currency === code}
          aria-label={code === "INR" ? "Show prices in Indian Rupees" : "Show prices in US Dollars"}
          className={`rounded-full font-medium transition-colors ${pad} ${
            currency === code ? "bg-accent text-navy" : "text-ink-muted hover:text-white"
          }`}
        >
          {PRICING_CURRENCY_LABELS[code]}
        </button>
      ))}
    </div>
  );
}

export function pricingCurrencySymbol(currency: PricingCurrency): string {
  return currency === "INR" ? "₹" : "$";
}
