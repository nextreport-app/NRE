import { Suspense } from "react";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CURRENCY_SYMBOLS } from "@/lib/nre/format";
import { ReportUploadWizard } from "@/components/report-upload-wizard";
import { PaywallScreen } from "@/components/paywall-screen";
import { getSubscriptionStatus } from "@/lib/subscription";
import { isGoogleAdsApiConfigured, isMetaApiConfigured, isTikTokApiConfigured } from "@/lib/integrations-config";
import { shouldShowTikTokForCurrentVisitor } from "@/lib/visitor-geo";
import {
  loadPreviousMonthDataCampaigns,
  parsePreviousMonthSelectedCampaigns,
} from "@/lib/nre/previous-month-data";

export default async function NewReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) notFound();

  const [client, user] = await Promise.all([
    prisma.client.findUnique({ where: { id } }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        name: true,
        email: true,
        planId: true,
        trialEndsAt: true,
        googleRefreshToken: true,
        metaConnectedName: true,
        metaAccessToken: true,
        googleAdsRefreshToken: true,
        tiktokAdsEnabled: true,
        tiktokAccessToken: true,
        ga4Enabled: true,
        ga4RefreshToken: true,
      },
    }),
  ]);
  if (!client || client.userId !== session.user.id) notFound();
  if (!user) notFound();

  const status = getSubscriptionStatus(user);
  const showTikTokOption = await shouldShowTikTokForCurrentVisitor();

  let previousMonthCampaigns: string[] = [];
  if (client.previousMonthDataUrl) {
    try {
      previousMonthCampaigns = await loadPreviousMonthDataCampaigns(client.previousMonthDataUrl);
    } catch {
      previousMonthCampaigns = [];
    }
  }
  const previousMonthSelectedCampaigns = parsePreviousMonthSelectedCampaigns(client.previousMonthSelectedCampaigns);

  if (status.isBlocked) {
    return (
      <PaywallScreen
        message="Your free trial has ended. Choose a plan to generate reports for this client."
        userEmail={user.email}
        userName={user.name}
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Suspense fallback={<p className="p-6 text-[13px] text-dash-ink-secondary">Loading…</p>}>
        <ReportUploadWizard
          clientId={client.id}
          clientName={client.accountName}
          clientTimezone={client.timezone}
          currencySymbol={CURRENCY_SYMBOLS[client.currency] ?? "$"}
          hasGoogleDriveConnected={!!user.googleRefreshToken}
          initialLastDriveFolderId={client.lastDriveFolderId}
          initialLastDriveFolderName={client.lastDriveFolderName}
          hasPreviousMonthData={!!client.previousMonthDataUrl}
          initialPreviousMonthDataUpdatedAt={client.previousMonthDataUpdatedAt?.toISOString() ?? null}
          initialPreviousMonthCampaigns={previousMonthCampaigns}
          initialPreviousMonthSelectedCampaigns={previousMonthSelectedCampaigns}
          clientTemplate={client.template}
          metaConnected={!!user.metaAccessToken}
          metaConnectedName={user.metaConnectedName}
          metaConfigured={isMetaApiConfigured()}
          googleAdsConfigured={isGoogleAdsApiConfigured()}
          googleAdsConnected={!!user.googleAdsRefreshToken}
          tiktokConfigured={isTikTokApiConfigured()}
          tiktokConnected={!!user.tiktokAccessToken}
          hasGa4Property={!!client.ga4PropertyId}
          ga4Connected={!!user.ga4RefreshToken || user.ga4Enabled}
          showTikTokOption={showTikTokOption}
          clientMonthlyBudget={client.monthlyBudget}
          clientShowBudgetPacingOnCover={client.showBudgetPacingOnCover}
        />
      </Suspense>
    </div>
  );
}
