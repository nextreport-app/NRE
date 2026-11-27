import { ReportReminderDashboard } from "@/components/report-reminder-dashboard";
import { reminderView } from "@/lib/report-reminders/model";
import { resolveClientUser } from "@/lib/client-provider-connections";
import { clientConnectionState } from "@/lib/client-card-summary";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ClientList } from "@/components/client-list";
import { ClientsGettingStarted } from "@/components/clients-getting-started";
import { ClientsPageHeader, ClientsPageSupportLine } from "@/components/clients-page-chrome";

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ task?: string }> }) {
  const scheduling = (await searchParams).task === "schedule";
  const session = await auth();
  const userId = session?.user?.id;
  const owner = userId ? await prisma.user.findUnique({ where: { id: userId }, select: { emailVerified: true, metaAdsEnabled: true, metaAccessToken: true, ga4Enabled: true, ga4RefreshToken: true, gscEnabled: true, gscRefreshToken: true } }) : null;
  const clients = userId
    ? await prisma.client.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          lastReportSentAt: true,
          reportReminder: true,
          userId: true, hasProviderConnections: true,
          accountName: true,
          currency: true,
          timezone: true,
          metaAdAccountId: true,
          metaAdAccountName: true,
          reports: { where: { status: "COMPLETE" }, orderBy: [{ completedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }], take: 1, select: { completedAt: true, createdAt: true } },
          reportSchedules: { where: { enabled: true }, orderBy: { nextRunAt: "asc" }, take: 1, select: { nextRunAt: true, timezone: true } },
          ga4PropertyId: true,
          gscSiteUrl: true,
          ga4PropertyName: true,
          previousMonthDataUrl: true,
          previousMonthDataUpdatedAt: true,
        },
      })
    : [];

  const reminderNow = new Date().toISOString();
  const clientCards = await Promise.all(clients.map(async (c) => {
    const clientOwner=await resolveClientUser(owner,c);
    return ({
    id: c.id,
    accountName: c.accountName,
    lastReportSentAt: c.lastReportSentAt?.toISOString() ?? null,
    reminder: c.reportReminder ? reminderView(c.reportReminder) : null,
    reminderNow,
    currency: c.currency,
    timezone: c.timezone,
    hasPreviousMonthData: !!c.previousMonthDataUrl,
    previousMonthDataUpdatedAt: c.previousMonthDataUpdatedAt?.toISOString() ?? null,
    metaConnection: clientConnectionState(!!c.metaAdAccountId, !!(clientOwner?.metaAdsEnabled && clientOwner.metaAccessToken)),
    ga4Connection: clientConnectionState(!!c.ga4PropertyId, !!(clientOwner?.ga4Enabled && clientOwner.ga4RefreshToken)),
    gscConnection: clientConnectionState(!!c.gscSiteUrl, !!(clientOwner?.gscEnabled && clientOwner.gscRefreshToken)),
    gscSiteName: c.gscSiteUrl,
    metaAccountName: c.metaAdAccountName,
    lastReportAt: (c.reports[0]?.completedAt ?? c.reports[0]?.createdAt)?.toISOString() ?? null,
    nextScheduleAt: c.reportSchedules[0]?.nextRunAt.toISOString() ?? null,
    nextScheduleTimezone: c.reportSchedules[0]?.timezone ?? c.timezone,
    hasGa4Property: !!c.ga4PropertyId,
    ga4PropertyName: c.ga4PropertyName,
  });}));

  const isEmpty = clientCards.length === 0;

  return (
    <div className="nre-clients-page mx-auto max-w-5xl">
      <ClientsPageHeader isEmpty={isEmpty} clientCount={clientCards.length} scheduling={scheduling} />

      {!isEmpty && <ReportReminderDashboard now={reminderNow} items={clientCards} />}
      {isEmpty ? <ClientsGettingStarted emailVerified={!!owner?.emailVerified} /> : <ClientList clients={clientCards} totalCount={clientCards.length} scheduling={scheduling} />}

      <ClientsPageSupportLine />
    </div>
  );
}
