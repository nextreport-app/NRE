"use client";

import { CurrencyPricing } from "@/components/currency-pricing";
import { CurrencySelector } from "@/components/currency-selector";
import { useSiteCopy } from "@/hooks/use-site-copy";

export function PricingCtaSection({
  loggedIn,
  userEmail,
  userName,
}: {
  loggedIn: boolean;
  userEmail?: string | null;
  userName?: string | null;
}) {
  const { marketing } = useSiteCopy();

  return (
    <section className="bg-navy px-6 py-20">
      <div className="mx-auto max-w-5xl text-center">
        <h2 className="text-2xl font-semibold text-white sm:text-3xl">{marketing.pricingTitle}</h2>
        <p className="mt-3 text-base text-ink-muted">{marketing.pricingSubtitle}</p>

        <div className="mt-6 flex flex-col items-center justify-center gap-2">
          <p className="text-sm text-ink-muted">{marketing.pricingCurrencyLabel}</p>
          <CurrencySelector />
        </div>

        <CurrencyPricing loggedIn={loggedIn} userEmail={userEmail} userName={userName} />

        <p className="mt-10 text-sm text-ink-muted">
          Need a demo? Email us at{" "}
          <a href="mailto:hello@nextreport.in" className="text-accent hover:underline">
            hello@nextreport.in
          </a>
        </p>
      </div>
    </section>
  );
}
