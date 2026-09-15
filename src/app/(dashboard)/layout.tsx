import { Nav } from "@/components/nav";
import { OnboardingChecklist } from "@/components/onboarding-checklist";
import { TrialBanner } from "@/components/trial-banner";
import { ToastProvider } from "@/components/toast";
import { auth } from "@/lib/auth";
import { getDashboardOnboarding } from "@/lib/onboarding-state";
import { prisma } from "@/lib/prisma";
import { getSubscriptionStatus } from "@/lib/subscription";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const user = session?.user
    ? await prisma.user.findUnique({ where: { id: session.user.id }, select: { email: true, planId: true, trialEndsAt: true } })
    : null;
  const status = user ? getSubscriptionStatus(user) : null;
  const onboarding = session?.user ? await getDashboardOnboarding(session.user.id) : null;

  return (
    <ToastProvider>
      <div className="flex min-h-screen flex-1 flex-col bg-dash-bg">
        <Nav />
        {status && <TrialBanner status={status} />}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
          {onboarding?.show ? (
            <OnboardingChecklist steps={onboarding.steps} progress={onboarding.progress} />
          ) : null}
          {children}
        </main>
      </div>
    </ToastProvider>
  );
}
