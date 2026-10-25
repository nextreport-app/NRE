import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { PublicNav } from "@/components/public-nav";
import { BetaBanner } from "@/components/beta-banner";
import { CurrencyPricing } from "@/components/currency-pricing";
import { PricingCurrencyBanner } from "@/components/pricing-currency-banner";
import { PricingComparisonTable } from "@/components/pricing/pricing-comparison-table";
import { JsonLd } from "@/components/json-ld";
import { breadcrumbJsonLd, faqPageJsonLd, pageMetadata } from "@/lib/seo";
import { PRICING_FAQS } from "@/lib/pricing-faq";
import { PLATFORM_LIST_SHORT } from "@/lib/plan-labels";

export const metadata: Metadata = pageMetadata({
  title: "Pricing — Agency Reporting Software",
  description:
    "Simple pricing for multi-platform agency reporting. Agency from ₹799/mo ($9), Professional unlimited clients from ₹1,299/mo ($15). 7-day free trial.",
  path: "/pricing",
});

export default async function PricingPage() {
  const session = await auth();
  const loggedIn = !!session?.user;

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            breadcrumbJsonLd([
              { name: "Home", path: "/" },
              { name: "Pricing", path: "/pricing" },
            ]),
            faqPageJsonLd(PRICING_FAQS.map((faq) => ({ question: faq.q, answer: faq.a }))),
          ],
        }}
      />
      <BetaBanner />
      <PublicNav loggedIn={loggedIn} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-16">
        <div className="text-center">
          <h1 className="text-3xl font-semibold text-white sm:text-4xl">Simple, Transparent Pricing</h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-ink-muted">
            {PLATFORM_LIST_SHORT} — CSV or API sync; share PowerPoint (.pptx), live links, or Google Slides.
          </p>
        </div>

        <PricingCurrencyBanner />

        <p className="mt-8 text-center text-xs text-ink-muted">
          ✓ 7-day free trial · ✓ White-label client reports · ✓ No credit card required · ✓ Cancel anytime · ✓
          INR or USD billing
        </p>

        <CurrencyPricing loggedIn={loggedIn} userEmail={session?.user?.email} userName={session?.user?.name} />

        <PricingComparisonTable />

        <p className="mx-auto mt-10 max-w-xl text-center text-sm text-ink-muted">
          Running a larger agency?{" "}
          <a href="mailto:hello@nextreport.in" className="text-accent hover:underline">
            Email us
          </a>{" "}
          for custom billing or onboarding — no separate Enterprise tier required to get started.
        </p>

        <div className="mt-20">
          <h2 className="text-center text-2xl font-semibold text-white">Frequently Asked Questions</h2>

          <div className="mx-auto mt-8 max-w-2xl space-y-3">
            {PRICING_FAQS.map((faq) => (
              <details
                key={faq.q}
                className="group rounded-lg border border-navy-border bg-navy-panel p-4 open:pb-4"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-white">
                  {faq.q}
                  <span className="ml-4 text-ink-muted transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-ink-secondary">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
