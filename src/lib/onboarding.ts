export type OnboardingStepId = "add-client" | "connect-platforms" | "generate-report";

export interface OnboardingStep {
  id: OnboardingStepId;
  title: string;
  description: string;
  href: string;
  done: boolean;
  optional?: boolean;
}

export interface OnboardingStateInput {
  dismissedAt: Date | null;
  clientCount: number;
  firstClientId: string | null;
  hasPlatformConnection: boolean;
  completeReportCount: number;
}

export function buildOnboardingSteps(input: OnboardingStateInput): OnboardingStep[] {
  const hasClient = input.clientCount > 0;
  const clientHref = hasClient && input.firstClientId ? `/clients/${input.firstClientId}` : "/clients/new";
  const reportHref =
    hasClient && input.firstClientId ? `/clients/${input.firstClientId}/reports/new` : "/clients/new";

  return [
    {
      id: "add-client",
      title: "Add your first client",
      description: "Set the client name, currency, and logo — every report uses that branding automatically.",
      href: clientHref,
      done: hasClient,
    },
    {
      id: "connect-platforms",
      title: "Connect ad accounts (optional)",
      description: "Link Meta, Google Ads, TikTok, or GA4 once in Account settings, then sync from API in the wizard.",
      href: "/account#meta-ads",
      done: input.hasPlatformConnection,
      optional: true,
    },
    {
      id: "generate-report",
      title: "Generate your first report",
      description: "Open New Report on a client — upload a CSV or sync from API, then download .pptx or share a link.",
      href: reportHref,
      done: input.completeReportCount > 0,
    },
  ];
}

export function shouldShowOnboarding(input: OnboardingStateInput, steps = buildOnboardingSteps(input)): boolean {
  if (input.dismissedAt) return false;

  const requiredSteps = steps.filter((step) => !step.optional);
  return requiredSteps.some((step) => !step.done);
}

export function onboardingProgress(steps: OnboardingStep[]): { completed: number; total: number } {
  const required = steps.filter((step) => !step.optional);
  const completed = required.filter((step) => step.done).length;
  return { completed, total: required.length };
}

export function hasAnyPlatformConnection(flags: {
  metaConnectedUserId?: string | null;
  metaAdsEnabled?: boolean;
  googleAdsRefreshToken?: string | null;
  googleAdsEnabled?: boolean;
  ga4RefreshToken?: string | null;
  ga4Enabled?: boolean;
  tiktokRefreshToken?: string | null;
  tiktokAdsEnabled?: boolean;
}): boolean {
  return (
    !!flags.metaConnectedUserId ||
    !!flags.metaAdsEnabled ||
    !!flags.googleAdsRefreshToken ||
    !!flags.googleAdsEnabled ||
    !!flags.ga4RefreshToken ||
    !!flags.ga4Enabled ||
    !!flags.tiktokRefreshToken ||
    !!flags.tiktokAdsEnabled
  );
}
