import Link from "next/link";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { PublicNav } from "@/components/public-nav";
import { CurrencyPricing } from "@/components/currency-pricing";

export const metadata: Metadata = {
  title: "Pricing — NextReport",
  description:
    "Simple, transparent pricing for NextReport. Starter and Professional plans for agencies of any size, with a 7-day free trial.",
};

const FAQS = [
  {
    q: "Is there really no credit card required for the trial?",
    a: "Correct. Sign up and get 7 days of full access with no payment details required. You only need to subscribe when your trial ends.",
  },
  {
    q: "What happens when my trial ends?",
    a: "You will see a prompt to subscribe. If you choose not to subscribe, you will not be able to generate new reports but your account and client data stays safe.",
  },
  {
    q: "Can I switch plans later?",
    a: "Yes. You can upgrade or downgrade at any time from your billing page. Changes take effect immediately.",
  },
];

export default async function PricingPage() {
  const session = await auth();
  const loggedIn = !!session?.user;

  return (
    <>
      <PublicNav loggedIn={loggedIn} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-16">
        <Link href="/" className="text-sm text-accent hover:underline">
          ← Back to NextReport
        </Link>

        <div className="mt-6 text-center">
          <h1 className="text-3xl font-semibold text-white sm:text-4xl">Simple, Transparent Pricing</h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-ink-muted">
            Everything you need to automate your ad reporting. No hidden fees.
          </p>
        </div>

        <p className="mt-8 text-center text-xs text-ink-muted">
          ✓ 7-day free trial · ✓ No credit card required · ✓ Cancel anytime · ✓ Instant access
        </p>

        <CurrencyPricing loggedIn={loggedIn} userEmail={session?.user?.email} userName={session?.user?.name} />

        <div className="mt-20">
          <h2 className="text-center text-2xl font-semibold text-white">Frequently Asked Questions</h2>

          <div className="mx-auto mt-8 max-w-2xl space-y-3">
            {FAQS.map((faq) => (
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
