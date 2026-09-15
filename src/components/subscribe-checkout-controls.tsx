"use client";

import { useState } from "react";
import { BillingIntervalToggle } from "@/components/billing-interval-toggle";
import { CurrencySelector } from "@/components/currency-selector";
import { usePricingCurrency } from "@/components/pricing-currency-provider";
import { PRICING_CURRENCY_NOTE } from "@/lib/currency";
import type { BillingInterval } from "@/lib/razorpay";

export function useSubscribeCheckoutOptions(defaultInterval: BillingInterval = "monthly") {
  const { currency } = usePricingCurrency();
  const [interval, setInterval] = useState<BillingInterval>(defaultInterval);
  return { currency, interval, setInterval };
}

/** Currency + monthly/annual toggles shared by paywall, billing, and upgrade flows. */
export function SubscribeCheckoutControls({
  interval,
  onIntervalChange,
  className = "",
}: {
  interval: BillingInterval;
  onIntervalChange: (interval: BillingInterval) => void;
  className?: string;
}) {
  const { currency } = usePricingCurrency();

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <BillingIntervalToggle interval={interval} onChange={onIntervalChange} variant="dashboard" />
        <CurrencySelector compact />
      </div>
      <p className="max-w-md text-center text-[12px] leading-relaxed text-dash-ink-secondary">
        {PRICING_CURRENCY_NOTE[currency]}
      </p>
    </div>
  );
}
