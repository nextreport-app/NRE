import { Nav } from "@/components/nav";
import { TrialBanner } from "@/components/trial-banner";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSubscriptionStatus } from "@/lib/subscription";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const user = session?.user
    ? await prisma.user.findUnique({ where: { id: session.user.id }, select: { planId: true, trialEndsAt: true } })
    : null;
  const status = user ? getSubscriptionStatus(user) : null;

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <Nav />
      {status && <TrialBanner status={status} />}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
