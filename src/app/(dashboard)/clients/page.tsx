import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ClientList } from "@/components/client-list";

export default async function ClientsPage() {
  const session = await auth();
  const clients = session?.user
    ? await prisma.client.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
        include: { reports: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } } },
      })
    : [];

  const clientCards = clients.map((c) => ({
    id: c.id,
    accountName: c.accountName,
    currency: c.currency,
    timezone: c.timezone,
    monthlyBudget: c.monthlyBudget,
    template: c.template,
    lastReportAt: c.reports[0]?.createdAt.toISOString() ?? null,
  }));

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-[24px] font-bold text-dash-ink">My Clients</h1>
        <Link
          href="/clients/new"
          className="rounded-md bg-dash-accent px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-dash-accent-hover"
        >
          + New Client
        </Link>
      </div>

      {clientCards.length === 0 ? (
        <div className="flex flex-col items-center rounded-lg border border-dash-border bg-dash-card px-10 py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-dash-bg text-2xl" aria-hidden="true">
            👥
          </div>
          <h2 className="text-[18px] font-semibold text-dash-ink">No clients yet</h2>
          <p className="mt-1 text-[15px] text-dash-ink-secondary">
            Add your first client to start generating reports
          </p>
          <Link
            href="/clients/new"
            className="mt-6 rounded-md bg-dash-accent px-6 py-3 text-[14px] font-semibold text-white hover:bg-dash-accent-hover"
          >
            + Add Client
          </Link>
        </div>
      ) : (
        <ClientList clients={clientCards} />
      )}
    </div>
  );
}
