import "server-only";

import { prisma } from "@/lib/prisma";
import {
  buildOnboardingSteps,
  hasAnyPlatformConnection,
  onboardingProgress,
  shouldShowOnboarding,
  type OnboardingStep,
} from "@/lib/onboarding";

export interface DashboardOnboarding {
  show: boolean;
  steps: OnboardingStep[];
  progress: { completed: number; total: number };
}

export async function getDashboardOnboarding(userId: string): Promise<DashboardOnboarding> {
  const [user, clientCount, firstClient, completeReportCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        onboardingDismissedAt: true,
        metaConnectedUserId: true,
        metaAdsEnabled: true,
        googleAdsRefreshToken: true,
        googleAdsEnabled: true,
        ga4RefreshToken: true,
        ga4Enabled: true,
        tiktokRefreshToken: true,
        tiktokAdsEnabled: true,
      },
    }),
    prisma.client.count({ where: { userId } }),
    prisma.client.findFirst({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    }),
    prisma.report.count({
      where: {
        status: "COMPLETE",
        client: { userId },
      },
    }),
  ]);

  const input = {
    dismissedAt: user?.onboardingDismissedAt ?? null,
    clientCount,
    firstClientId: firstClient?.id ?? null,
    hasPlatformConnection: hasAnyPlatformConnection(user ?? {}),
    completeReportCount,
  };

  const steps = buildOnboardingSteps(input);
  const show = shouldShowOnboarding(input, steps);

  return {
    show,
    steps,
    progress: onboardingProgress(steps),
  };
}
