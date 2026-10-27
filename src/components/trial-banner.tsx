"use client";

import Link from "next/link";
import { useSiteCopy } from "@/hooks/use-site-copy";
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
  const { dashboard: d } = useSiteCopy();

  if (status.isSubscribed) return null;

  if (status.isTrialing && !status.isTrialExpired) {
    return (
      <div className="nre-trial-banner--active border-b border-amber-900 bg-amber-950/40 px-4 py-2 text-center text-sm text-amber-200">
        {d.trialEnds(status.trialDaysLeft)}{" "}
        <Link href="/pricing" className="font-medium underline">
          {d.trialSubscribeNow}
        </Link>
      </div>
    );
  }

  return (
    <div className="nre-trial-banner--expired border-b border-red-900 bg-red-950/40 px-4 py-2 text-center text-sm text-red-200">
      {status.isTrialing ? d.trialEnded : "Your paid access has ended."}{" "}
      <Link href="/pricing" className="font-medium underline">
        {d.trialSubscribeContinue}
      </Link>
    </div>
  );
}
