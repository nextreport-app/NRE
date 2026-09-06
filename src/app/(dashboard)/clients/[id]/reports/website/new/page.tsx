import { Suspense } from "react";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { WebsiteReportWizard } from "@/components/website-report-wizard";
import { PaywallScreen } from "@/components/paywall-screen";
import { getSubscriptionStatus } from "@/lib/subscription";

export default async function NewWebsiteReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) notFound();

  const [client, user] = await Promise.all([
    prisma.client.findUnique({ where: { id } }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true, name: true, planId: true, trialEndsAt: true, ga4Enabled: true, ga4RefreshToken: true },
    }),
  ]);
  if (!client || client.userId !== session.user.id) notFound();
  if (!user) notFound();

  const status = getSubscriptionStatus(user);
  if (status.isBlocked) {
    return (
      <PaywallScreen
        message="Your free trial has ended. Choose a plan to generate Website Traffic reports."
        userEmail={user.email}
        userName={user.name}
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Suspense fallback={<p className="p-6 text-[13px] text-dash-ink-secondary">Loading…</p>}>
        <WebsiteReportWizard
          clientId={client.id}
          clientName={client.accountName}
          hasGa4Property={!!client.ga4PropertyId}
          ga4Connected={!!user.ga4RefreshToken || user.ga4Enabled}
        />
      </Suspense>
    </div>
  );
}
