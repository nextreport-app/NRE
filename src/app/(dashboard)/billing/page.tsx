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

/** Active (subscribed or admin override) / Trial / Expired — the badge the plan card leads with. */
function StatusBadge({ label, tone }: { label: string; tone: "success" | "accent" | "error" }) {
  const toneClasses =
    tone === "success"
      ? "bg-dash-success/15 text-dash-success"
      : tone === "accent"
        ? "bg-dash-accent/15 text-dash-accent"
        : "bg-dash-error/15 text-dash-error";
  return <span className={`rounded-full px-3 py-1 text-[13px] font-semibold ${toneClasses}`}>{label}</span>;
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

  const badge =
    status.isAdminOverride || status.isSubscribed
      ? { label: "Active", tone: "success" as const }
      : status.isTrialing && !status.isTrialExpired
        ? { label: "Trial", tone: "accent" as const }
        : { label: "Expired", tone: "error" as const };

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-6 text-[24px] font-bold text-dash-ink">Billing</h1>

      <div className="rounded-lg border border-dash-border bg-dash-card p-6">
        <div className="flex items-center gap-3">
          <p className="text-[24px] font-bold text-dash-ink">{PLAN_LABELS[status.planId]}</p>
          <StatusBadge label={badge.label} tone={badge.tone} />
        </div>

        {status.isAdminOverride && (
          <p className="mt-3 text-[15px] text-dash-ink-secondary">
            Full access granted via admin override (<code className="text-dash-ink-secondary">ADMIN_EMAILS</code>) — no
            subscription needed.
          </p>
        )}

        {!status.isAdminOverride && status.isTrialing && (
          <p className="mt-3 text-[15px] text-dash-ink-secondary">
            {status.isTrialExpired
              ? "Your trial has ended."
              : `Trial ends in ${status.trialDaysLeft} day${status.trialDaysLeft === 1 ? "" : "s"}, on ${formatDate(user.trialEndsAt)}.`}
          </p>
        )}

        {status.isSubscribed && nextBillingDate && (
          <p className="mt-3 text-[15px] text-dash-ink-secondary">Next billing date: {formatDate(nextBillingDate)}</p>
        )}

        {status.planId === "cancelled" && (
          <p className="mt-3 text-[15px] text-dash-ink-secondary">
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
                className="rounded-md bg-dash-accent px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-dash-accent-hover"
              />
              <SubscribeButton
                planId="professional"
                loggedIn
                userEmail={user.email}
                userName={user.name}
                label="Subscribe to Professional"
                className="rounded-md border border-dash-secondary px-5 py-2.5 text-[14px] font-semibold text-dash-ink hover:bg-dash-secondary/20"
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
              className="rounded-md bg-dash-accent px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-dash-accent-hover"
            />
          )}

          {!status.isAdminOverride && status.isSubscribed && <CancelSubscriptionButton />}
        </div>
      </div>

      <Link href="/pricing" className="mt-4 inline-block text-[14px] text-dash-accent hover:underline">
        View plan details →
      </Link>
    </div>
  );
}
