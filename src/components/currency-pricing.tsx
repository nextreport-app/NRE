"use client";

import { useEffect, useState } from "react";
import { SubscribeButton } from "./subscribe-button";
import { countryCodeToCurrency, readCachedCountry, writeCachedCountry, type PricingCurrency } from "@/lib/currency";

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
      "Unlimited report generation",
      "Meta Ads reporting",
      "Google Ads reporting",
      "AI-written campaign summaries",
      "PowerPoint and Google Slides export",
      "Google Drive auto-save",
      "Email support within 24 hours",
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
      "Everything in Starter",
      "Priority email support",
      "Early access to new features",
      "Google Ads advanced reporting (coming soon)",
      "LinkedIn Ads reporting (coming soon)",
    ],
  },
];

const PAYMENT_METHOD_LINE: Record<PricingCurrency, string> = {
  INR: "Pay securely with UPI, Cards, Net Banking",
  USD: "Pay securely with Credit or Debit Card",
};

const PRICING_NOTE: Record<PricingCurrency, string> = {
  INR: "Prices in Indian Rupees. Indian customers only. International pricing available in USD.",
  USD: "Prices in US Dollars. Indian customers can switch to INR above for local payment options.",
};

// ipapi.co's free tier is unauthenticated and rate-limited but needs no
// API key — called directly from the browser (not proxied through our
// own server) so it sees the visitor's real public IP, not Vercel's.
const IPAPI_URL = "https://ipapi.co/json/";
const IPAPI_TIMEOUT_MS = 5000;

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
  loggedIn,
  userEmail,
  userName,
}: {
  plan: Plan;
  currency: PricingCurrency;
  loggedIn: boolean;
  userEmail?: string | null;
  userName?: string | null;
}) {
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
        <span className="text-4xl font-semibold text-white">
          {currency === "INR" ? plan.priceInr : plan.priceUsd}
        </span>
        <span className="text-sm text-ink-muted">/month</span>
      </div>
      <p className="mt-1 text-xs text-ink-muted">{PAYMENT_METHOD_LINE[currency]}</p>

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
  // Defaults to INR on first paint (not USD): most early users are Indian,
  // so this is the choice that shows the RIGHT currency with zero lag for
  // the majority of visitors — international visitors briefly see INR
  // before the detection below (cached or freshly fetched) switches them
  // to USD. This is also what's left in place if detection fails entirely.
  const [currency, setCurrency] = useState<PricingCurrency>("INR");

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), IPAPI_TIMEOUT_MS);

    // A cached country code (see lib/currency.ts, 24h TTL) resolves
    // immediately and skips the network call altogether — no flash at all
    // for a repeat visitor, not even the brief one first-time visitors see.
    // Funneled through the same promise chain as the network path (rather
    // than calling setCurrency synchronously right here) so there's exactly
    // one place setCurrency is ever called from this effect.
    const cached = readCachedCountry();
    const detectedCountryCode: Promise<string | null> = cached
      ? Promise.resolve(cached.countryCode)
      : fetch(IPAPI_URL, { signal: controller.signal })
          .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`ipapi.co responded ${res.status}`))))
          .then((data: { country_code?: string }) => {
            const countryCode = data.country_code ?? null;
            writeCachedCountry(countryCode);
            return countryCode;
          });

    detectedCountryCode
      .then((countryCode) => setCurrency(countryCodeToCurrency(countryCode)))
      .catch(() => {
        // Detection failed, timed out, or was blocked (ad blockers/privacy
        // extensions commonly block third-party geo-IP calls) — the INR
        // default above is left standing, and nothing is cached (so it's
        // retried on the next visit rather than "stuck" on a guess).
      })
      .finally(() => clearTimeout(timeout));

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  return (
    <>
      <div className="mt-12 grid gap-8 sm:grid-cols-2">
        {PLANS.map((plan) => (
          <PlanCard
            key={plan.name}
            plan={plan}
            currency={currency}
            loggedIn={loggedIn}
            userEmail={userEmail}
            userName={userName}
          />
        ))}
      </div>

      <div className="mx-auto mt-8 flex max-w-xl flex-col items-center gap-3">
        <div className="flex items-center gap-1 rounded-full border border-navy-border bg-navy-panel p-1 text-sm">
          <button
            type="button"
            onClick={() => setCurrency("INR")}
            aria-pressed={currency === "INR"}
            className={`rounded-full px-3 py-1 transition-colors ${
              currency === "INR" ? "bg-accent text-white" : "text-ink-muted hover:text-ink-secondary"
            }`}
          >
            🇮🇳 INR
          </button>
          <button
            type="button"
            onClick={() => setCurrency("USD")}
            aria-pressed={currency === "USD"}
            className={`rounded-full px-3 py-1 transition-colors ${
              currency === "USD" ? "bg-accent text-white" : "text-ink-muted hover:text-ink-secondary"
            }`}
          >
            🌍 USD
          </button>
        </div>

        <p className="text-center text-xs text-ink-muted">{PRICING_NOTE[currency]}</p>
      </div>
    </>
  );
}
