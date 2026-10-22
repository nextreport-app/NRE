"use client";

import Link from "next/link";
import { usePricingCurrency } from "@/components/pricing-currency-provider";
import { useSiteCopy } from "@/hooks/use-site-copy";
import { getPlanDisplayName } from "@/lib/plan-labels";

const MONTHLY_FROM = {
  starter: { inr: "₹799", usd: "$9" },
  professional: { inr: "₹1,299", usd: "$15" },
} as const;

export function PricingTeaserStrip({ loggedIn }: { loggedIn: boolean }) {
  const { marketing, home } = useSiteCopy();
  const { currency } = usePricingCurrency();
  const perMonth = home.pricing.perMonth;
  const agencyFrom = currency === "INR" ? MONTHLY_FROM.starter.inr : MONTHLY_FROM.starter.usd;
  const proFrom = currency === "INR" ? MONTHLY_FROM.professional.inr : MONTHLY_FROM.professional.usd;

  return (
    <section
      className="border-y border-navy-border bg-navy-panel/60 px-4 py-8 sm:px-6 sm:py-10"
      aria-labelledby="pricing-teaser-heading"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="text-center lg:text-left">
          <h2 id="pricing-teaser-heading" className="text-xl font-semibold text-white sm:text-2xl">
            {marketing.pricingTitle}
          </h2>
          <p className="mt-1.5 text-sm text-ink-muted">{marketing.pricingSubtitle}</p>
        </div>

        <div className="flex flex-col items-center gap-5 lg:items-end">
          <p className="text-center text-sm text-ink-secondary lg:text-right">
            <span className="font-medium text-white">{getPlanDisplayName("starter")}</span>
            {" from "}
            <span className="font-semibold text-white">
              {agencyFrom}
              {perMonth}
            </span>
            <span className="mx-2 hidden text-ink-muted sm:inline" aria-hidden="true">
              ·
            </span>
            <span className="mt-1 block sm:mt-0 sm:inline">
              <span className="font-medium text-white">{getPlanDisplayName("professional")}</span>
              {" from "}
              <span className="font-semibold text-white">
                {proFrom}
                {perMonth}
              </span>
            </span>
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center rounded-full border border-navy-border bg-navy/80 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:border-ink-muted hover:bg-navy"
            >
              View pricing
            </Link>
            <Link
              href={loggedIn ? "/clients" : "/signup"}
              className="inline-flex items-center justify-center rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
            >
              {loggedIn ? marketing.tryCtaDashboard : marketing.tryCtaStartTrial}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
