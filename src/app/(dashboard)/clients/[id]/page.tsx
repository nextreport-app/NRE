import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ClientForm } from "@/components/client-form";
import { DeleteClientButton } from "@/components/delete-client-button";
import { PreviousMonthDataUpload } from "@/components/previous-month-data-upload";
import { previousMonthDataFileName } from "@/lib/storage";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) notFound();

  const client = await prisma.client.findUnique({ where: { id } });
  if (!client || client.userId !== session.user.id) notFound();

  const reports = await prisma.report.findMany({
    where: { clientId: client.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return (
    <div className="mx-auto max-w-xl space-y-10">
      <div>
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-white">{client.accountName}</h1>
          <DeleteClientButton clientId={client.id} />
        </div>
        <ClientForm
          clientId={client.id}
          initial={{
            accountName: client.accountName,
            currency: client.currency,
            timezone: client.timezone,
            monthlyBudget: client.monthlyBudget,
            template: client.template,
          }}
          hasLogo={!!client.logoUrl}
        />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-medium text-white">Previous Month Data</h2>
        <PreviousMonthDataUpload
          clientId={client.id}
          initialFileName={client.previousMonthDataUrl ? previousMonthDataFileName(client.previousMonthDataUrl) : null}
          initialUpdatedAt={client.previousMonthDataUpdatedAt?.toISOString() ?? null}
        />
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-medium text-white">Reports</h2>
          <Link
            href={`/clients/${client.id}/reports/new`}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
          >
            Generate report
          </Link>
        </div>
        {reports.length === 0 ? (
          <p className="text-sm text-ink-muted">No reports generated yet.</p>
        ) : (
          <ul className="divide-y divide-navy-border rounded-lg border border-navy-border bg-navy-panel">
            {reports.map((r) => (
              <li key={r.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm text-white">
                    {r.weekStart && r.weekEnd ? `${r.weekStart} – ${r.weekEnd}` : r.fileName || r.id}
                  </p>
                  <p className="text-xs text-ink-muted">{r.status}</p>
                </div>
                {r.status === "COMPLETE" && (
                  <a
                    href={`/api/reports/${r.id}/download`}
                    className="text-sm text-accent hover:underline"
                  >
                    Download
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
