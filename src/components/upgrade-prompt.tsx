import { SubscribeButton } from "./subscribe-button";

/** Shown instead of the "New client" form once a Starter-plan user has hit the 5-client cap (see lib/subscription.ts's clientLimit). */
export function UpgradePrompt({
  userEmail,
  userName,
}: {
  userEmail?: string | null;
  userName?: string | null;
}) {
  return (
    <div className="mx-auto max-w-md rounded-lg border border-navy-border bg-navy-panel p-8 text-center">
      <h1 className="text-xl font-semibold text-white">Client limit reached</h1>
      <p className="mt-2 text-sm text-ink-muted">
        The Starter plan includes up to 5 client accounts. Upgrade to Professional for unlimited clients.
      </p>
      <SubscribeButton
        planId="professional"
        loggedIn
        userEmail={userEmail}
        userName={userName}
        label="Upgrade to Professional"
        className="mt-6 w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
      />
    </div>
  );
}
