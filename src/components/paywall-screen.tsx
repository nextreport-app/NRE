import Link from "next/link";
import { SubscribePlanCards } from "@/components/subscribe-plan-cards";

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
    <div className="mx-auto max-w-xl rounded-lg border border-dash-border bg-dash-card p-8 text-center">
      <h1 className="text-xl font-semibold text-dash-ink">Subscribe to Continue</h1>
      <p className="mt-2 text-sm text-dash-ink-secondary">{message}</p>

      <div className="mt-6">
        <SubscribePlanCards userEmail={userEmail} userName={userName} />
      </div>

      <Link href="/pricing" className="mt-6 inline-block text-sm text-dash-accent hover:underline">
        Compare full plan details →
      </Link>
    </div>
  );
}
