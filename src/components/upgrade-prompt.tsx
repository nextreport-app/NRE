import Link from "next/link";
import { CLIENT_LIMIT_EXPLAINER } from "@/lib/plan-labels";

/** Shown instead of the "New client" form once an Agency-plan user has hit their client cap (see lib/subscription.ts's clientLimit). */
export function UpgradePrompt({
  clientLimit,
}: {
  clientLimit: number;
  userEmail?: string | null;
  userName?: string | null;
}) {
  return (
    <div className="mx-auto max-w-md rounded-lg border border-dash-border bg-dash-card p-8 text-center">
      <h1 className="text-xl font-semibold text-dash-ink">Client limit reached</h1>
      <p className="mt-2 text-sm text-dash-ink-secondary">
        You have reached your plan’s {clientLimit}-client limit. {CLIENT_LIMIT_EXPLAINER} Delete an unused client to add a different brand. Agency includes 10 clients; Professional includes 50. Contact us for more than 50 clients or for a paid-plan change.

      </p>
      <div className="mt-6">
        <Link href="/billing" className="inline-block rounded-md bg-dash-accent px-4 py-2 text-sm font-semibold text-[#0d1b2e]">Review plans in Billing</Link>

      </div>
    </div>
  );
}
