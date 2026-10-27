import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ClientForm } from "@/components/client-form";
import { PaywallScreen } from "@/components/paywall-screen";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { getClientCapacityUsage } from "@/lib/client-capacity";
import { getSubscriptionStatus } from "@/lib/subscription";

export default async function NewClientPage() {
  const session = await auth();
  if (!session?.user) notFound();

  const [user, capacity] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true, planId: true, trialEndsAt: true, paidThrough: true, emailVerified: true },
    }),
    getClientCapacityUsage(session.user.id),
  ]);
  if (!user) notFound();

  if (!user.emailVerified) return <div className="mx-auto max-w-xl rounded-xl border border-dash-border bg-dash-card p-6"><h1 className="text-xl font-semibold text-dash-ink">Verify your email first</h1><p className="mt-3 text-sm leading-relaxed text-dash-ink-secondary">Use the verification link in your inbox, or resend it from the banner above. Then return here to add your first client.</p><Link href="/clients" className="mt-4 inline-block text-sm text-dash-accent">Back to your workspace →</Link></div>;
  const status = getSubscriptionStatus(user);

  if (status.isBlocked) {
    return (
      <PaywallScreen
        message="Your trial or paid access has ended. Choose a plan to continue."
        userEmail={user.email}
        userName={user.name}
      />
    );
  }

  if (status.clientLimit !== null && capacity.activeClientCount >= status.clientLimit) {
    return <UpgradePrompt clientLimit={status.clientLimit} userEmail={user.email} userName={user.name} />;
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-6 text-[24px] font-bold text-dash-ink">New client</h1>
      <p className="mb-5 text-sm leading-relaxed text-dash-ink-secondary">Start with the client name, ad-account currency and timezone. Optional branding and budget settings can be added later.</p>
      <ClientForm />
    </div>
  );
}
