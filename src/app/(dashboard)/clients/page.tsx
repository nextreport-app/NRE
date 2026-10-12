import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ClientList } from "@/components/client-list";
import { ClientsEmptyPanel } from "@/components/clients-empty-panel";
import { SupportTicketLink } from "@/components/support-ticket-link";
import { WhatsAppChatLink } from "@/components/whatsapp-chat-link";
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
      {!showGettingStarted || !isEmpty ? (
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[26px] font-bold tracking-tight text-dash-ink">My Clients</h1>
            <p className="mt-1 text-[15px] text-dash-ink-secondary">
              {isEmpty
                ? "Your client workspaces will appear here."
                : `${clientCards.length} client${clientCards.length === 1 ? "" : "s"} · pick one to generate or manage`}
            </p>
          </div>
          {!isEmpty ? (
            <Link
              href="/clients/new"
              className="rounded-lg bg-dash-accent px-5 py-2.5 text-[15px] font-semibold text-dash-ink hover:bg-dash-accent-hover"
            >
              + New Client
            </Link>
          ) : null}
        </div>
      ) : null}

      {isEmpty ? (
        showGettingStarted ? (
          <div
            className="rounded-xl border border-dashed border-dash-border/90 bg-dash-bg/40 px-6 py-10 text-center"
            aria-hidden={false}
          >
            <p className="text-[14px] text-dash-ink-secondary">
              Client workspaces you add in step 1 will be listed here.
            </p>
          </div>
        ) : (
          <ClientsEmptyPanel />
        )
      ) : (
        <ClientList clients={clientCards} totalCount={clientCards.length} />
      )}

      <p className="mt-10 text-center text-[13px] leading-relaxed text-dash-ink-secondary sm:text-left">
        Questions? <SupportTicketLink openInNewTab /> or{" "}
        <WhatsAppChatLink message="Hi — I need help with NextReport." />
      </p>
    </div>
  );
}
