import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSubscriptionStatus } from "@/lib/subscription";
import { SubscribeButton } from "@/components/subscribe-button";
import { CancelSubscriptionButton } from "@/components/cancel-subscription-button";

const PLAN_LABELS: Record<string, string> = {
  trial: "Free Trial",
  starter: "Starter",
  professional: "Professional",
  cancelled: "Cancelled",
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export default async function BillingPage() {
  const session = await auth();
  if (!session?.user) notFound();

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, planId: true, trialEndsAt: true, subscribedAt: true },
  });
  if (!user) notFound();

  const status = getSubscriptionStatus(user);

  // Estimated, not authoritative — see lib/razorpay.ts's file header: this
  // integration is Razorpay's one-time Orders API, not the Subscriptions
  // API, so there's no server-side recurring charge to read a real renewal
  // date from. Shown for information only, 30 days after the last payment.
  const nextBillingDate = user.subscribedAt
    ? new Date(user.subscribedAt.getTime() + 30 * MS_PER_DAY)
    : null;

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-6 text-xl font-semibold text-white">Billing</h1>

      <div className="rounded-lg border border-navy-border bg-navy-panel p-6">
        <p className="text-xs uppercase tracking-wide text-ink-muted">Current plan</p>
        <p className="mt-1 text-2xl font-semibold text-white">{PLAN_LABELS[status.planId]}</p>

        {status.isTrialing && (
          <p className="mt-2 text-sm text-ink-secondary">
            {status.isTrialExpired
              ? "Your trial has ended."
              : `Trial ends in ${status.trialDaysLeft} day${status.trialDaysLeft === 1 ? "" : "s"}, on ${formatDate(user.trialEndsAt)}.`}
          </p>
        )}

        {status.isSubscribed && nextBillingDate && (
          <p className="mt-2 text-sm text-ink-secondary">Next billing date: {formatDate(nextBillingDate)}</p>
        )}

        {status.planId === "cancelled" && (
          <p className="mt-2 text-sm text-ink-secondary">
            Your subscription was cancelled. Resubscribe any time to regain access.
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          {(status.isTrialing || status.planId === "cancelled") && (
            <>
              <SubscribeButton
                planId="starter"
                loggedIn
                userEmail={user.email}
                userName={user.name}
                label="Subscribe to Starter"
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
              />
              <SubscribeButton
                planId="professional"
                loggedIn
                userEmail={user.email}
                userName={user.name}
                label="Subscribe to Professional"
                className="rounded-md border border-navy-border px-4 py-2 text-sm font-medium text-white hover:bg-navy"
              />
            </>
          )}

          {status.planId === "starter" && (
            <SubscribeButton
              planId="professional"
              loggedIn
              userEmail={user.email}
              userName={user.name}
              label="Upgrade to Professional"
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
            />
          )}

          {status.isSubscribed && <CancelSubscriptionButton />}
        </div>
      </div>

      <Link href="/pricing" className="mt-4 inline-block text-sm text-accent hover:underline">
        View plan details →
      </Link>
    </div>
  );
}
