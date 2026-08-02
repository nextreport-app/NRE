import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ClientForm } from "@/components/client-form";
import { PaywallScreen } from "@/components/paywall-screen";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { getSubscriptionStatus } from "@/lib/subscription";

export default async function NewClientPage() {
  const session = await auth();
  if (!session?.user) notFound();

  const [user, clientCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true, planId: true, trialEndsAt: true },
    }),
    prisma.client.count({ where: { userId: session.user.id } }),
  ]);
  if (!user) notFound();

  const status = getSubscriptionStatus(user);

  if (status.isBlocked) {
    return (
      <PaywallScreen
        message="Your free trial has ended. Choose a plan to keep adding clients and generating reports."
        userEmail={user.email}
        userName={user.name}
      />
    );
  }

  if (status.clientLimit !== null && clientCount >= status.clientLimit) {
    return <UpgradePrompt clientLimit={status.clientLimit} userEmail={user.email} userName={user.name} />;
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-6 text-[24px] font-bold text-dash-ink">New client</h1>
      <ClientForm />
    </div>
  );
}
