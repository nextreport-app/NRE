import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reminderView } from "@/lib/report-reminders/model";
import { ReportReminderSettings } from "@/components/report-reminder-settings";
export default async function ClientReminderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) notFound();
  const client = await prisma.client.findFirst({
    where: { id, userId: session.user.id },
    include: { reportReminder: true },
  });
  if (!client) notFound();
  return (
    <div className="mx-auto max-w-3xl text-dash-ink">
      <Link
        className="inline-flex min-h-11 items-center text-sm text-dash-ink-secondary hover:text-dash-ink"
        href="/clients"
      >
        ← My Clients
      </Link>
      <h1 className="mt-3 break-words text-2xl font-bold">
        Report reminder · {client.accountName}
      </h1>
      <p className="mt-2 text-sm text-dash-ink-secondary">
        Keep track of the next report you need to send, separately from
        automatic draft preparation.
      </p>
      <ReportReminderSettings
        key={`${client.reportReminder?.updatedAt.toISOString()}:${client.lastReportSentAt?.toISOString()}`}
        clientId={id}
        timezone={client.timezone}
        initial={
          client.reportReminder ? reminderView(client.reportReminder) : null
        }
        lastSentAt={client.lastReportSentAt?.toISOString() ?? null}
        now={new Date().toISOString()}
      />
    </div>
  );
}
