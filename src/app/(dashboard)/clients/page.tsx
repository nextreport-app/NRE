import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ClientList } from "@/components/client-list";
import { ClientsEmptyPanel } from "@/components/clients-empty-panel";
import {
  ClientsGuidePlaceholder,
  ClientsPageHeader,
  ClientsPageSupportLine,
} from "@/components/clients-page-chrome";
import { getDashboardOnboarding } from "@/lib/onboarding-state";

export default async function ClientsPage() {
  const session = await auth();
  const userId = session?.user?.id;
  const clients = userId
    ? await prisma.client.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          accountName: true,
          currency: true,
          timezone: true,
          ga4PropertyId: true,
          ga4PropertyName: true,
          previousMonthDataUrl: true,
          previousMonthDataUpdatedAt: true,
        },
      })
    : [];

  const clientCards = clients.map((c) => ({
    id: c.id,
    accountName: c.accountName,
    currency: c.currency,
    timezone: c.timezone,
    hasPreviousMonthData: !!c.previousMonthDataUrl,
    previousMonthDataUpdatedAt: c.previousMonthDataUpdatedAt?.toISOString() ?? null,
    hasGa4Property: !!c.ga4PropertyId,
    ga4PropertyName: c.ga4PropertyName,
  }));

  const isEmpty = clientCards.length === 0;
  const onboarding = isEmpty && userId ? await getDashboardOnboarding(userId) : null;
  const showGettingStarted = onboarding?.show ?? false;

  return (
    <div className="mx-auto max-w-5xl">
      <ClientsPageHeader
        isEmpty={isEmpty}
        clientCount={clientCards.length}
        showGettingStarted={showGettingStarted}
      />

      {isEmpty ? (
        showGettingStarted ? (
          <ClientsGuidePlaceholder />
        ) : (
          <ClientsEmptyPanel />
        )
      ) : (
        <ClientList clients={clientCards} totalCount={clientCards.length} />
      )}

      <ClientsPageSupportLine />
    </div>
  );
}
