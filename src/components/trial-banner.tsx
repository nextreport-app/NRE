import Link from "next/link";
import type { SubscriptionStatus } from "@/lib/subscription";

/**
 * Point 3 of the subscription spec ("show at top of dashboard when trial
 * is active"), plus an expired/cancelled variant so a user browsing the
 * dashboard after their trial lapses understands why "New client" and
 * "Generate report" are paywalled the moment they click through — without
 * this, only clicking into those actions would explain anything. Point 6
 * ("subscribed users: full access, no banner") — null whenever isSubscribed.
 */
export function TrialBanner({ status }: { status: SubscriptionStatus }) {
  if (status.isSubscribed) return null;

  if (status.isTrialing && !status.isTrialExpired) {
    return (
      <div className="border-b border-amber-900 bg-amber-950/40 px-4 py-2 text-center text-sm text-amber-200">
        Your free trial ends in {status.trialDaysLeft} day{status.trialDaysLeft === 1 ? "" : "s"} —{" "}
        <Link href="/billing" className="font-medium underline">
          Subscribe now
        </Link>
      </div>
    );
  }

  return (
    <div className="border-b border-red-900 bg-red-950/40 px-4 py-2 text-center text-sm text-red-200">
      Your free trial has ended —{" "}
      <Link href="/billing" className="font-medium underline">
        Subscribe to continue
      </Link>
    </div>
  );
}
