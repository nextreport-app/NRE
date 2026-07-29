import Link from "next/link";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { SubscribeButton } from "@/components/subscribe-button";

export const metadata: Metadata = {
  title: "Pricing — NextReport",
  description:
    "Simple, transparent pricing for NextReport. Starter and Professional plans for agencies of any size, with a 7-day free trial.",
};

interface Plan {
  id: "starter" | "professional";
  name: string;
  priceInr: string;
  priceUsd: string;
  bestFor: string;
  features: string[];
  highlighted?: boolean;
}

const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    priceInr: "₹999",
    priceUsd: "$12",
    bestFor: "Freelancers and small agencies",
    features: [
      "Up to 5 client accounts",
      "Meta Ads reporting",
      "Google Ads reporting",
      "Unlimited report generation",
      "PPTX and Google Slides export",
      "AI-written campaign summaries",
      "Email support",
    ],
  },
  {
    id: "professional",
    name: "Professional",
    priceInr: "₹2,499",
    priceUsd: "$29",
    bestFor: "Growing agencies managing multiple clients",
    highlighted: true,
    features: [
      "Unlimited client accounts",
      "Meta Ads reporting",
      "Google Ads reporting",
      "Unlimited report generation",
      "PPTX and Google Slides export",
      "AI-written campaign summaries",
      "Google Drive auto-save",
      "Priority email support",
      "Early access to new features",
    ],
  },
];

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
  plan,
  loggedIn,
  userEmail,
  userName,
}: {
  plan: Plan;
  loggedIn: boolean;
  userEmail?: string | null;
  userName?: string | null;
}) {
  return (
    <div
      className={`relative flex flex-col rounded-xl border p-8 ${
        plan.highlighted
          ? "border-accent bg-navy-panel shadow-[0_0_0_1px_rgba(74,144,217,0.4)]"
          : "border-navy-border bg-navy-panel"
      }`}
    >
      {plan.highlighted && (
        <span className="absolute -top-3 left-8 rounded-full bg-accent px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
          Most Popular
        </span>
      )}

      <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
      <p className="mt-1 text-sm text-ink-muted">{plan.bestFor}</p>

      <div className="mt-6 flex items-baseline gap-1">
        <span className="text-4xl font-semibold text-white">{plan.priceInr}</span>
        <span className="text-sm text-ink-muted">/month</span>
      </div>
      <p className="mt-1 text-xs text-ink-muted">or {plan.priceUsd}/month for international customers</p>

      <ul className="mt-8 space-y-3 text-sm text-ink-secondary">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <CheckIcon />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <SubscribeButton
        planId={plan.id}
        loggedIn={loggedIn}
        userEmail={userEmail}
        userName={userName}
        className={`mt-8 w-full rounded-md px-5 py-2.5 text-center text-sm font-medium ${
          plan.highlighted
            ? "bg-accent text-white hover:bg-accent-hover"
            : "border border-navy-border text-white hover:bg-navy"
        }`}
      />
    </div>
  );
}

export default async function PricingPage() {
  const session = await auth();
  const loggedIn = !!session?.user;

  return (
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

      <div className="mt-12 grid gap-8 sm:grid-cols-2">
        {PLANS.map((plan) => (
          <PlanCard
            key={plan.name}
            plan={plan}
            loggedIn={loggedIn}
            userEmail={session?.user?.email}
            userName={session?.user?.name}
          />
        ))}
      </div>

      <p className="mx-auto mt-8 max-w-xl text-center text-xs text-ink-muted">
        Prices shown in INR for Indian customers and USD for international customers. All plans include
        a 7-day free trial. Cancel anytime.
      </p>

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
  );
}
