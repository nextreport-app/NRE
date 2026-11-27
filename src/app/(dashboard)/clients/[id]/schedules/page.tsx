import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ScheduledReportsCard } from "@/components/scheduled-reports-card";

export default async function ClientSchedulesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) notFound();
  const client = await prisma.client.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, accountName: true },
  });
  if (!client) notFound();

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl text-dash-ink">
      <Link
        href="/clients"
        className="inline-flex min-h-11 items-center text-sm text-dash-ink-secondary hover:text-dash-ink"
      >
        ← Back to My Clients
      </Link>
      <h1 className="mt-3 break-words text-2xl font-bold">
        Report scheduling · {client.accountName}
      </h1>
      <p className="mt-2 text-sm text-dash-ink-secondary">
        Prepare recurring Meta Ads reports. Review each draft, then send it when
        you’re ready.
      </p>
      <Link
        href="/reports?tab=scheduled"
        className="my-5 inline-flex min-h-11 items-center rounded-xl border border-dash-border bg-dash-card px-4 py-2 text-sm font-medium hover:border-dash-accent"
      >
        Review scheduled drafts →
      </Link>
      <ScheduledReportsCard
        key={client.id}
        clientId={client.id}
        clientName={client.accountName}
      />
    </div>
  );
}
