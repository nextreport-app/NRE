"use client";

import { useState } from "react";
import { BillingIntervalToggle } from "@/components/billing-interval-toggle";
import { SubscribeButton } from "./subscribe-button";
import { usePricingCurrency } from "@/components/pricing-currency-provider";
import { PRICING_CURRENCY_NOTE, type PricingCurrency } from "@/lib/currency";
import { AGENCY_CLIENT_LIMIT, getPlanDisplayName, type BillablePlanId } from "@/lib/plan-labels";
import { CtaTrustBadges } from "@/components/marketing/cta-trust-badges";
import type { BillingInterval } from "@/lib/razorpay";
import { useSiteCopy } from "@/hooks/use-site-copy";

import { formattedPlanPrice } from "@/lib/plan-pricing";

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className="mt-0.5 h-4 w-4 flex-none text-accent"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.415 0l-3.5-3.5a1 1 0 111.415-1.42L8.5 12.085l6.79-6.795a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function PlanCard({
  planId,
  highlighted,
  currency,
  interval,
  loggedIn,
  userEmail,
  userName,
}: {
  planId: BillablePlanId;
  highlighted?: boolean;
  currency: PricingCurrency;
  interval: BillingInterval;
  loggedIn: boolean;
  userEmail?: string | null;
  userName?: string | null;
}) {
  const { home } = useSiteCopy();
  const p = home.pricing;
  const planCopy = home.pricing.plans[planId];
  const name = getPlanDisplayName(planId);
  const monthlyPrice = formattedPlanPrice(planId, currency);
  const annualPrice = formattedPlanPrice(planId, currency, "annual");
  const displayPrice = interval === "annual" ? annualPrice : monthlyPrice;
  const ctaClassName = `mt-8 w-full rounded-md px-5 py-2.5 text-center text-sm font-medium ${
    highlighted
      ? "bg-accent text-[#0d1b2e] hover:bg-accent-hover"
      : "border border-navy-border text-white hover:bg-navy"
  }`;

  return (
    <div
      className={`relative flex flex-col rounded-xl border p-8 ${
        highlighted
          ? "border-accent bg-navy-panel shadow-[0_0_0_1px_rgba(74,144,217,0.4)]"
          : "border-navy-border bg-navy-panel"
      }`}
    >
      {highlighted && (
        <span className="absolute -top-3 left-8 rounded-full bg-accent px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#0d1b2e]">
          {p.mostPopular}
        </span>
      )}

      <h3 className="text-lg font-semibold text-white">{name}</h3>
      <p className="mt-1 text-sm text-ink-muted">{planCopy.bestFor}</p>
      <p className="mt-3 text-base font-semibold text-accent-orange">
        {planId === "starter" ? `Up to ${AGENCY_CLIENT_LIMIT} client workspaces` : "Unlimited client workspaces"}
      </p>

      <div className="mt-5 flex items-baseline gap-1">
        <span className="text-4xl font-semibold text-white">{displayPrice}</span>
        <span className="text-sm text-ink-muted">{interval === "annual" ? p.perYear : p.perMonth}</span>
      </div>
      {interval === "annual" && <p className="mt-1 text-xs font-medium text-emerald-400">{p.saveAnnual}</p>}
      <p className="mt-1 text-[11px] text-ink-muted/80">{currency === "INR" ? p.exclGst : p.exclTax}</p>

      <ul className="mt-8 space-y-3 text-left text-sm text-ink-secondary">
        {planCopy.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-left">
            <CheckIcon />
            <span className="min-w-0 flex-1 text-left leading-snug">{feature}</span>
          </li>
        ))}
      </ul>

      <SubscribeButton
        planId={planId}
        currency={currency}
        interval={interval}
        loggedIn={loggedIn}
        userEmail={userEmail}
        userName={userName}
        className={ctaClassName}
        label={`${p.subscribeToPrefix} ${name}`}
        loadingLabel={p.redirecting}
      />
      <CtaTrustBadges className="mt-3" />
    </div>
  );
}

export function CurrencyPricing({
  loggedIn,
  userEmail,
  userName,
}: {
  loggedIn: boolean;
  userEmail?: string | null;
  userName?: string | null;
}) {
  const { currency } = usePricingCurrency();
  const [interval, setInterval] = useState<BillingInterval>("monthly");
  const { home } = useSiteCopy();
  const p = home.pricing;

  return (
    <>
      <div className="mx-auto mb-8 flex max-w-xl justify-center">
        <BillingIntervalToggle
          interval={interval}
          onChange={setInterval}
          variant="pricing"
          labels={{ aria: p.billingPeriodAria, monthly: p.monthly, annual: p.annual }}
        />
      </div>

      <div className="mt-4 grid gap-8 sm:grid-cols-2">
        <PlanCard
          planId="starter"
          currency={currency}
          interval={interval}
          loggedIn={loggedIn}
          userEmail={userEmail}
          userName={userName}
        />
        <PlanCard
          planId="professional"
          highlighted
          currency={currency}
          interval={interval}
          loggedIn={loggedIn}
          userEmail={userEmail}
          userName={userName}
        />
      </div>

      <div className="mx-auto mt-8 flex max-w-xl flex-col items-center gap-3">
        <p className="text-center text-xs text-ink-muted">{PRICING_CURRENCY_NOTE[currency]}</p>
      </div>
    </>
  );
}
