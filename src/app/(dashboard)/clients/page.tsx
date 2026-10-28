import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ClientList } from "@/components/client-list";
import { ClientsGettingStarted } from "@/components/clients-getting-started";
import { ClientsPageHeader, ClientsPageSupportLine } from "@/components/clients-page-chrome";

export default async function ClientsPage() {
  const session = await auth();
  const userId = session?.user?.id;
  const owner = userId ? await prisma.user.findUnique({ where: { id: userId }, select: { emailVerified: true } }) : null;
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

  return (
    <div className="nre-clients-page mx-auto max-w-5xl">
      <ClientsPageHeader isEmpty={isEmpty} clientCount={clientCards.length} />

      {isEmpty ? <ClientsGettingStarted emailVerified={!!owner?.emailVerified} /> : <ClientList clients={clientCards} totalCount={clientCards.length} />}

      <ClientsPageSupportLine />
    </div>
  );
}
