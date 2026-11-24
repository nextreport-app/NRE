import { ClientWorkspaceNav } from "@/components/client-workspace-nav";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ScheduledReportsCard } from "@/components/scheduled-reports-card";

export default async function ClientSchedulesPage({ params }: { params: Promise<{ id: string }> }) {
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
      <Link href="/clients?task=schedule" className="text-sm text-dash-ink-secondary hover:underline">← Choose another client</Link>
      <h1 className="mt-3 break-words text-2xl font-bold">Schedule reports · {client.accountName}</h1>
      <p className="mt-2 text-sm text-dash-ink-secondary">Fresh Meta API data → private draft → your review and approval → send.</p>
      <p className="mt-2 text-sm text-dash-ink-secondary">Schedules have their own dates and campaign settings. One-off CSV uploads and wizard selections are not copied.</p>
      <ClientWorkspaceNav clientId={client.id} current="schedules" />
      <Link href="/reports?tab=scheduled" className="mb-4 inline-block text-sm text-dash-accent hover:underline">Review scheduled drafts →</Link>
      <ScheduledReportsCard key={client.id} clientId={client.id} />
    </div>
  );
}
