import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ClientList } from "@/components/client-list";
import { SupportTicketLink } from "@/components/support-ticket-link";

export default async function ClientsPage() {
  const session = await auth();
  const clients = session?.user
    ? await prisma.client.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          accountName: true,
          currency: true,
          timezone: true,
          monthlyBudget: true,
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
    monthlyBudget: c.monthlyBudget,
    hasPreviousMonthData: !!c.previousMonthDataUrl,
    previousMonthDataUpdatedAt: c.previousMonthDataUpdatedAt?.toISOString() ?? null,
    hasGa4Property: !!c.ga4PropertyId,
    ga4PropertyName: c.ga4PropertyName,
  }));

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 rounded-lg border border-dash-border bg-dash-card/60 px-4 py-3 text-[15px] leading-relaxed text-dash-ink-secondary">
        Have a question or an issue?{" "}
        <SupportTicketLink openInNewTab /> or{" "}
        <Link href="/contact" target="_blank" rel="noopener noreferrer" className="font-medium text-dash-accent underline hover:no-underline">
          chat with us
        </Link>
        .
      </div>

      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-dash-ink">My Clients</h1>
          <p className="mt-1 text-[15px] text-dash-ink-secondary">
            {clientCards.length === 0
              ? "Add a client to start generating reports."
              : `${clientCards.length} client${clientCards.length === 1 ? "" : "s"} · pick one to generate or manage`}
          </p>
        </div>
        {clientCards.length > 0 ? (
          <Link
            href="/clients/new"
            className="rounded-md bg-dash-accent px-5 py-2.5 text-[15px] font-semibold text-dash-ink hover:bg-dash-accent-hover"
          >
            + New Client
          </Link>
        ) : null}
      </div>

      {clientCards.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dash-border bg-dash-card px-10 py-16 text-center">
          <div
            className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-dash-bg text-[28px]"
            aria-hidden="true"
          >
            👥
          </div>
          <h2 className="text-[20px] font-semibold text-dash-ink">No clients yet</h2>
          <p className="mt-2 max-w-sm text-[16px] leading-relaxed text-dash-ink-secondary">
            Add your first client account — set currency and timezone once, then generate Meta, Google, TikTok, or Google Analytics reports anytime.
          </p>
          <Link
            href="/clients/new"
            className="mt-8 rounded-md bg-dash-accent px-6 py-3 text-[15px] font-semibold text-dash-ink hover:bg-dash-accent-hover"
          >
            + Add Client
          </Link>
        </div>
      ) : (
        <ClientList clients={clientCards} totalCount={clientCards.length} />
      )}
    </div>
  );
}
