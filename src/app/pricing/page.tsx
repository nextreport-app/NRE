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
    q: "What payment methods do you accept?",
    a: "We accept all major credit and debit cards, UPI, net banking, and wallets for Indian customers. International customers can pay via credit or debit card.",
  },
  {
    q: "Can I change my plan later?",
    a: "Yes, you can upgrade or downgrade your plan at any time. Changes take effect from the next billing cycle.",
  },
  {
    q: "Is there a free trial?",
    a: "Yes, all new accounts include a 7-day free trial with full access to all features. No credit card required to start.",
  },
  {
    q: "What currencies do you accept?",
    a: "Indian customers are billed in INR. International customers are billed in USD.",
  },
  {
    q: "Do you offer refunds?",
    a: "We offer a full refund within 7 days of your first payment if you are not satisfied.",
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
