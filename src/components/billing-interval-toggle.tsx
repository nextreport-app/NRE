"use client";

import type { BillingInterval } from "@/lib/razorpay";

type BillingIntervalToggleProps = {
  interval: BillingInterval;
  onChange: (interval: BillingInterval) => void;
  /** Dashboard pages use dash tokens; public pricing uses navy/accent. */
  variant?: "dashboard" | "pricing";
  className?: string;
};

export function BillingIntervalToggle({
  interval,
  onChange,
  variant = "dashboard",
  className = "",
}: BillingIntervalToggleProps) {
  const isDashboard = variant === "dashboard";
  const shell = isDashboard
    ? "border border-dash-border bg-dash-card"
    : "border border-navy-border bg-navy-panel";
  const active = isDashboard ? "bg-dash-accent text-white" : "bg-accent text-white";
  const inactive = isDashboard
    ? "text-dash-ink-secondary hover:text-dash-ink"
    : "text-ink-muted hover:text-ink-secondary";

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-full p-1 text-sm ${shell} ${className}`}
      role="group"
      aria-label="Billing period"
    >
      <button
        type="button"
        onClick={() => onChange("monthly")}
        aria-pressed={interval === "monthly"}
        className={`rounded-full px-4 py-1 transition-colors ${
          interval === "monthly" ? active : inactive
        }`}
      >
        Monthly
      </button>
      <button
        type="button"
        onClick={() => onChange("annual")}
        aria-pressed={interval === "annual"}
        className={`rounded-full px-4 py-1 transition-colors ${
          interval === "annual" ? active : inactive
        }`}
      >
        Annual (save 20%)
      </button>
    </div>
  );
}
