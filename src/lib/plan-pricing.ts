/** Client-safe price catalogue. Amounts are minor units, before tax. */
import type { PricingCurrency } from "./currency";
import { getPlanDisplayName, type BillablePlanId } from "./plan-labels";

export type BillingInterval = "monthly" | "annual";
export const ANNUAL_DISCOUNT = 0.8;
export const PLANS = {
  starter: { name: getPlanDisplayName("starter"), amountPaise: 79_900, amountUsdCents: 900 },
  professional: { name: getPlanDisplayName("professional"), amountPaise: 129_900, amountUsdCents: 1_500 },
};

export function amountForCurrency(planId: BillablePlanId, currency: PricingCurrency, interval: BillingInterval = "monthly"): number {
  const monthly = currency === "INR" ? PLANS[planId].amountPaise : PLANS[planId].amountUsdCents;
  return interval === "annual" ? Math.round(monthly * 12 * ANNUAL_DISCOUNT) : monthly;
}

export function formattedPlanPrice(planId: BillablePlanId, currency: PricingCurrency, interval: BillingInterval = "monthly"): string {
  const amount = amountForCurrency(planId, currency, interval) / 100;
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency", currency, minimumFractionDigits: Number.isInteger(amount) ? 0 : 2, maximumFractionDigits: 2,
  }).format(amount);
}
