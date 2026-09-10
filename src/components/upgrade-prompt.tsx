import { SubscribeButton } from "./subscribe-button";

import { getPlanDisplayName } from "@/lib/plan-labels";

/** Shown instead of the "New client" form once an Agency-plan user has hit their client cap (see lib/subscription.ts's clientLimit). */
export function UpgradePrompt({
  clientLimit,
  userEmail,
  userName,
}: {
  clientLimit: number;
  userEmail?: string | null;
  userName?: string | null;
}) {
  return (
    <div className="mx-auto max-w-md rounded-lg border border-dash-border bg-dash-card p-8 text-center">
      <h1 className="text-xl font-semibold text-dash-ink">Client limit reached</h1>
      <p className="mt-2 text-sm text-dash-ink-secondary">
        You have used all {clientLimit} client slots on the {getPlanDisplayName("starter")} plan (lifetime limit). Upgrade to Professional for unlimited clients.
      </p>
      <SubscribeButton
        planId="professional"
        loggedIn
        userEmail={userEmail}
        userName={userName}
        label="Upgrade to Professional"
        className="mt-6 w-full rounded-md bg-dash-accent px-4 py-2 text-sm font-medium text-dash-ink hover:bg-dash-accent-hover"
      />
    </div>
  );
}
