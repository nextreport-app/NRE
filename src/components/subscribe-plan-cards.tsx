"use client";

import { SubscribeButton } from "@/components/subscribe-button";
import {
  SubscribeCheckoutControls,
  useSubscribeCheckoutOptions,
} from "@/components/subscribe-checkout-controls";
import { getPlanDisplayName, type BillablePlanId } from "@/lib/plan-labels";
import type { PricingCurrency } from "@/lib/currency";
import type { BillingInterval } from "@/lib/razorpay";

const ANNUAL_PRICES: Record<BillablePlanId, Record<PricingCurrency, string>> = {
  starter: { INR: "₹6,710", USD: "$77" },
  professional: { INR: "₹16,310", USD: "$192" },
};

const MONTHLY_PRICES: Record<BillablePlanId, Record<PricingCurrency, string>> = {
  starter: { INR: "₹699", USD: "$8" },
  professional: { INR: "₹1,699", USD: "$20" },
};

const PLAN_OPTIONS: { id: BillablePlanId; highlighted?: boolean }[] = [
  { id: "starter" },
  { id: "professional", highlighted: true },
];

function PlanPrice({
  planId,
  currency,
  interval,
}: {
  planId: BillablePlanId;
  currency: PricingCurrency;
  interval: BillingInterval;
}) {
  const price =
    interval === "annual" ? ANNUAL_PRICES[planId][currency] : MONTHLY_PRICES[planId][currency];
  return (
    <>
      <p className="mt-1 text-lg font-semibold text-dash-ink">
        {price}
        <span className="text-[13px] font-normal text-dash-ink-secondary">
          {interval === "annual" ? "/year" : "/month"}
        </span>
      </p>
      {interval === "annual" && (
        <p className="text-[12px] font-medium text-emerald-400">Save 20% vs paying monthly</p>
      )}
    </>
  );
}

export function SubscribePlanCards({
  planIds,
  userEmail,
  userName,
}: {
  /** Defaults to both Agency and Professional. */
  planIds?: BillablePlanId[];
  userEmail?: string | null;
  userName?: string | null;
}) {
  const { currency, interval, setInterval } = useSubscribeCheckoutOptions();
  const plans = planIds
    ? PLAN_OPTIONS.filter((plan) => planIds.includes(plan.id))
    : PLAN_OPTIONS;

  return (
    <div>
      <SubscribeCheckoutControls interval={interval} onIntervalChange={setInterval} className="mb-6" />
      <div className={`grid gap-4 ${plans.length > 1 ? "sm:grid-cols-2" : ""}`}>
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`rounded-lg border p-4 text-left ${
              plan.highlighted ? "border-dash-accent bg-dash-accent/5" : "border-dash-border"
            }`}
          >
            <p className="font-medium text-dash-ink">{getPlanDisplayName(plan.id)}</p>
            <PlanPrice planId={plan.id} currency={currency} interval={interval} />
            <SubscribeButton
              planId={plan.id}
              currency={currency}
              interval={interval}
              loggedIn
              userEmail={userEmail}
              userName={userName}
              className={`mt-3 w-full rounded-md px-4 py-2 text-sm font-medium ${
                plan.highlighted
                  ? "bg-dash-accent text-white hover:bg-dash-accent-hover"
                  : "border border-dash-border text-dash-ink hover:bg-dash-secondary/20"
              }`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Single-plan subscribe CTA with currency and billing period controls (billing upgrade, client-limit prompt). */
export function SubscribeWithCheckoutOptions({
  planId,
  label,
  userEmail,
  userName,
  className,
}: {
  planId: BillablePlanId;
  label: string;
  userEmail?: string | null;
  userName?: string | null;
  className?: string;
}) {
  const { currency, interval, setInterval } = useSubscribeCheckoutOptions();

  return (
    <div>
      <SubscribeCheckoutControls interval={interval} onIntervalChange={setInterval} className="mb-4" />
      <SubscribeButton
        planId={planId}
        currency={currency}
        interval={interval}
        loggedIn
        userEmail={userEmail}
        userName={userName}
        label={label}
        className={
          className ??
          "w-full rounded-md bg-dash-accent px-4 py-2 text-sm font-medium text-white hover:bg-dash-accent-hover"
        }
      />
    </div>
  );
}
