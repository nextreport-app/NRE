/** Client-safe price catalogue. Amounts are minor-unit checkout totals. Tax treatment must match provider/invoicing configuration. */
import type { PricingCurrency } from "./currency";
import { getPlanDisplayName, type BillablePlanId } from "./plan-labels";

export type BillingInterval = "monthly" | "annual";
/** Annual billing charges ten monthly payments (two months free). */
export const ANNUAL_BILLED_MONTHS = 10;
export const PLANS = {
  starter: {
    name: getPlanDisplayName("starter"),
    amountPaise: 39_900,
    amountUsdCents: 500,
  },
  professional: {
    name: getPlanDisplayName("professional"),
    amountPaise: 99_900,
    amountUsdCents: 1_200,
  },
  agency_plus: {
    name: getPlanDisplayName("agency_plus"),
    amountPaise: 169_900,
    amountUsdCents: 2_000,
  },
};

export function amountForCurrency(
  planId: BillablePlanId,
  currency: PricingCurrency,
  interval: BillingInterval = "monthly",
): number {
  const monthly =
    currency === "INR"
      ? PLANS[planId].amountPaise
      : PLANS[planId].amountUsdCents;
  return interval === "annual" ? monthly * ANNUAL_BILLED_MONTHS : monthly;
}

export function formattedPlanPrice(
  planId: BillablePlanId,
  currency: PricingCurrency,
  interval: BillingInterval = "monthly",
): string {
  const amount = amountForCurrency(planId, currency, interval) / 100;
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency,
    currencyDisplay: currency === "USD" ? "code" : "symbol",
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Only historical, server-recorded checkouts use these exact previous launch prices. New purchases always use PLANS. */
export function isSupportedCheckoutAmount(
  planId: BillablePlanId,
  currency: PricingCurrency,
  interval: BillingInterval,
  amount: number,
): boolean {
  if (amount === amountForCurrency(planId, currency, interval)) return true;
  const legacy = {
    starter: {
      INR: { monthly: 79900, annual: 767040 },
      USD: { monthly: 900, annual: 8640 },
    },
    professional: {
      INR: { monthly: 129900, annual: 1247040 },
      USD: { monthly: 1500, annual: 14400 },
    },
  };
  return (
    planId !== "agency_plus" && legacy[planId][currency][interval] === amount
  );
}
