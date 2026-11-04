"use client";

import Link from "next/link";
import { usePricingCurrency } from "@/components/pricing-currency-provider";
import { useSiteCopy } from "@/hooks/use-site-copy";
import { getPlanDisplayName } from "@/lib/plan-labels";

import { formattedPlanPrice } from "@/lib/plan-pricing";

export function PricingTeaserStrip() {
  const { marketing, home } = useSiteCopy();
  const { currency } = usePricingCurrency();
  const perMonth = home.pricing.perMonth;
  const plans = [
    { id: "starter", clients: 10 },
    { id: "professional", clients: 50 },
    { id: "agency_plus", clients: 100 },
  ] as const;

  return (
    <section
      className="border-y border-navy-border bg-navy-panel px-4 py-8 sm:px-6 sm:py-10"
      aria-labelledby="pricing-teaser-heading"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="text-center lg:text-left">
          <h2 id="pricing-teaser-heading" className="text-xl font-semibold text-white sm:text-2xl">
            {marketing.pricingTitle}
          </h2>
          <p className="mt-1.5 text-sm text-ink-secondary">{marketing.pricingSubtitle}</p>
        </div>

        <div className="flex flex-col items-center gap-5 lg:items-end">
          <div className="space-y-2 text-center text-sm text-ink-secondary lg:text-right">
            {plans.map(plan => (
              <p key={plan.id}>
                <span className="font-medium text-white">{getPlanDisplayName(plan.id)}</span>{" · "}
                <span className="font-semibold text-white">{formattedPlanPrice(plan.id, currency)}{perMonth}</span>{" · "}
                {plan.clients} client workspaces
              </p>
            ))}
          </div>

          <Link
            href="/pricing"
            className="inline-flex items-center justify-center rounded-full border border-navy-border bg-navy/80 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:border-ink-muted hover:bg-navy"
          >
            View pricing
          </Link>
        </div>
      </div>
    </section>
  );
}
