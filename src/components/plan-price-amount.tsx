import type { PricingCurrency } from "@/lib/currency";
import type { BillablePlanId } from "@/lib/plan-labels";
import { amountForCurrency, formattedPlanPrice, type BillingInterval } from "@/lib/plan-pricing";

/** Keep the amount prominent while making international currency explicit. */
export function PlanPriceAmount({ planId, currency, interval = "monthly" }: {
  planId: BillablePlanId;
  currency: PricingCurrency;
  interval?: BillingInterval;
}) {
  if (currency === "INR") return <>{formattedPlanPrice(planId, currency, interval)}</>;
  const amount = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(amountForCurrency(planId, currency, interval) / 100);
  return <span className="inline-flex items-baseline gap-0.5 whitespace-nowrap">
    <span className="sr-only">{formattedPlanPrice(planId, currency, interval)}</span>
    <span aria-hidden="true" className="text-sm font-normal">$</span>
    <span aria-hidden="true">{amount}</span>
    <span aria-hidden="true" className="ml-0.5 text-xs font-medium">USD</span>
  </span>;
}
