"use client";

import type { BillingInterval } from "@/lib/razorpay";

type BillingIntervalToggleProps = {
  interval: BillingInterval;
  onChange: (interval: BillingInterval) => void;
  /** Dashboard pages use dash tokens; public pricing uses navy/accent. */
  variant?: "dashboard" | "pricing";
  className?: string;
  /** Localized labels (homepage pricing section). */
  labels?: { aria: string; monthly: string; annual: string };
};

export function BillingIntervalToggle({
  interval,
  onChange,
  variant = "dashboard",
  className = "",
  labels,
}: BillingIntervalToggleProps) {
  const monthlyLabel = labels?.monthly ?? "Monthly";
  const annualLabel = labels?.annual ?? "Annual (save 20%)";
  const ariaLabel = labels?.aria ?? "Billing period";
  const isDashboard = variant === "dashboard";
  const shell = isDashboard
    ? "border border-dash-border bg-dash-card"
    : "border border-navy-border bg-navy-panel";
  const active = isDashboard ? "bg-dash-accent text-[#0d1b2e]" : "bg-accent text-[#0d1b2e]";
  const inactive = isDashboard
    ? "text-dash-ink-secondary hover:text-dash-ink"
    : "text-ink-muted hover:text-ink-secondary";

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-full p-1 text-sm ${shell} ${className}`}
      role="group"
      aria-label={ariaLabel}
    >
      <button
        type="button"
        onClick={() => onChange("monthly")}
        aria-pressed={interval === "monthly"}
        className={`rounded-full px-4 py-1 transition-colors ${
          interval === "monthly" ? active : inactive
        }`}
      >
        {monthlyLabel}
      </button>
      <button
        type="button"
        onClick={() => onChange("annual")}
        aria-pressed={interval === "annual"}
        className={`rounded-full px-4 py-1 transition-colors ${
          interval === "annual" ? active : inactive
        }`}
      >
        {annualLabel}
      </button>
    </div>
  );
}
