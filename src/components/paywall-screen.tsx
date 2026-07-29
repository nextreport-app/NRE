import Link from "next/link";
import { SubscribeButton } from "./subscribe-button";

const PLAN_OPTIONS = [
  { id: "starter" as const, name: "Starter", priceInr: "₹999", priceUsd: "$12" },
  { id: "professional" as const, name: "Professional", priceInr: "₹2,499", priceUsd: "$29" },
];

/**
 * "Subscribe to Continue" screen shown in place of the client-creation or
 * report-generation form once a user is blocked (trial expired and never
 * subscribed, or a cancelled subscription) — see lib/subscription.ts's
 * isBlocked. Rendered on pages that already require a logged-in session
 * (notFound() above this in every caller), so userEmail/userName are
 * always available for Checkout's prefill.
 */
export function PaywallScreen({
  message,
  userEmail,
  userName,
}: {
  message: string;
  userEmail?: string | null;
  userName?: string | null;
}) {
  return (
    <div className="mx-auto max-w-xl rounded-lg border border-navy-border bg-navy-panel p-8 text-center">
      <h1 className="text-xl font-semibold text-white">Subscribe to Continue</h1>
      <p className="mt-2 text-sm text-ink-muted">{message}</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {PLAN_OPTIONS.map((plan) => (
          <div key={plan.id} className="rounded-lg border border-navy-border p-4 text-left">
            <p className="font-medium text-white">{plan.name}</p>
            <p className="mt-1 text-lg font-semibold text-white">
              {plan.priceInr}
              <span className="text-xs font-normal text-ink-muted">/month</span>
            </p>
            <p className="text-xs text-ink-muted">or {plan.priceUsd}/month international</p>
            <SubscribeButton
              planId={plan.id}
              loggedIn
              userEmail={userEmail}
              userName={userName}
              className="mt-3 w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
            />
          </div>
        ))}
      </div>

      <Link href="/pricing" className="mt-6 inline-block text-sm text-accent hover:underline">
        Compare full plan details →
      </Link>
    </div>
  );
}
