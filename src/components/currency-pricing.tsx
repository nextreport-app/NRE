"use client";

import { useState } from "react";
import { SubscribeButton } from "./subscribe-button";
import { usePricingCurrency } from "@/components/pricing-currency-provider";
import { PRICING_CURRENCY_NOTE, type PricingCurrency } from "@/lib/currency";
import type { BillingInterval } from "@/lib/razorpay";

const ANNUAL_PRICES = {
  starter: { inr: "₹6,710", usd: "$77" },
  professional: { inr: "₹16,310", usd: "$192" },
} as const;

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
    priceInr: "₹699",
    priceUsd: "$8",
    bestFor: "Freelancers and small agencies",
    features: [
      "Up to 10 client accounts",
      "Unlimited report generation",
      "Meta Ads — Marketing API sync",
      "Google Ads — API sync",
      "CSV upload — Meta & Google exports",
      "AI-written campaign summaries & insights",
      "PowerPoint and Google Slides export",
      "Live browser share link for clients",
      "PDF download for every report",
      "Google Drive auto-save",
      "Slack & Zapier webhooks",
      "Email support within 24 hours",
    ],
  },
  {
    id: "professional",
    name: "Professional",
    priceInr: "₹1,699",
    priceUsd: "$20",
    bestFor: "Growing agencies managing multiple clients",
    highlighted: true,
    features: [
      "Unlimited client accounts",
      "Everything in Starter",
      "Meta & Google API sync for every client",
      "Live browser share link & PDF on every report",
      "Priority email support",
      "Early access to new features",
      "Creative performance reporting",
      "Slack & Zapier on every report generated",
    ],
  },
];

const PAYMENT_METHOD_LINE: Record<PricingCurrency, string> = {
  INR: "Pay securely with UPI, Cards, Net Banking",
  USD: "Pay securely with Credit or Debit Card",
};

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
  currency,
  interval,
  loggedIn,
  userEmail,
  userName,
}: {
  plan: Plan;
  currency: PricingCurrency;
  interval: BillingInterval;
  loggedIn: boolean;
  userEmail?: string | null;
  userName?: string | null;
}) {
  const monthlyPrice = currency === "INR" ? plan.priceInr : plan.priceUsd;
  const annualPrice = currency === "INR" ? ANNUAL_PRICES[plan.id].inr : ANNUAL_PRICES[plan.id].usd;
  const displayPrice = interval === "annual" ? annualPrice : monthlyPrice;
  const ctaClassName = `mt-8 w-full rounded-md px-5 py-2.5 text-center text-sm font-medium ${
    plan.highlighted
      ? "bg-accent text-white hover:bg-accent-hover"
      : "border border-navy-border text-white hover:bg-navy"
  }`;

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
        <span className="text-4xl font-semibold text-white">{displayPrice}</span>
        <span className="text-sm text-ink-muted">{interval === "annual" ? "/year" : "/month"}</span>
      </div>
      {interval === "annual" && (
        <p className="mt-1 text-xs font-medium text-emerald-400">Save 20% vs paying monthly</p>
      )}
      <p className="mt-1 text-xs text-ink-muted">{PAYMENT_METHOD_LINE[currency]}</p>
      <p className="mt-0.5 text-[11px] text-ink-muted/80">
        {currency === "INR" ? "Excl. 18% GST" : "Excl. tax"}
      </p>

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
        currency={currency}
        interval={interval}
        loggedIn={loggedIn}
        userEmail={userEmail}
        userName={userName}
        className={ctaClassName}
      />
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

  return (
    <>
      <div className="mx-auto mb-8 flex max-w-xl justify-center">
        <div className="flex items-center gap-1 rounded-full border border-navy-border bg-navy-panel p-1 text-sm">
          <button
            type="button"
            onClick={() => setInterval("monthly")}
            aria-pressed={interval === "monthly"}
            className={`rounded-full px-4 py-1 transition-colors ${
              interval === "monthly" ? "bg-accent text-white" : "text-ink-muted hover:text-ink-secondary"
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setInterval("annual")}
            aria-pressed={interval === "annual"}
            className={`rounded-full px-4 py-1 transition-colors ${
              interval === "annual" ? "bg-accent text-white" : "text-ink-muted hover:text-ink-secondary"
            }`}
          >
            Annual (save 20%)
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-8 sm:grid-cols-2">
        {PLANS.map((plan) => (
          <PlanCard
            key={plan.name}
            plan={plan}
            currency={currency}
            interval={interval}
            loggedIn={loggedIn}
            userEmail={userEmail}
            userName={userName}
          />
        ))}
      </div>

      <div className="mx-auto mt-8 flex max-w-xl flex-col items-center gap-3">
        <p className="text-center text-xs text-ink-muted">{PRICING_CURRENCY_NOTE[currency]}</p>
      </div>
    </>
  );
}
