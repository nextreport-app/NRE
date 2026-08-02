import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DeleteClientButton } from "@/components/delete-client-button";
import { PreviousMonthDataUpload } from "@/components/previous-month-data-upload";
import { ReportHistoryList } from "@/components/report-history-list";
import { CURRENCY_SYMBOLS } from "@/lib/nre/format";
import { previousMonthDataFileName } from "@/lib/storage";

const REPORT_HISTORY_DAYS = 30;

/** Kept outside the component body — react-hooks/purity flags Date.now() called directly during render, even in an async Server Component that only ever runs once per request. */
function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

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

  const since = daysAgo(REPORT_HISTORY_DAYS);
  const reports = await prisma.report.findMany({
    where: { clientId: client.id, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
  });

  const reportItems = reports.map((r) => ({
    id: r.id,
    fileName: r.fileName,
    weekStart: r.weekStart,
    weekEnd: r.weekEnd,
    status: r.status,
    reportType: r.reportType,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <div>
      <div className="mb-6">
        <Link href="/clients" className="text-[13px] text-dash-ink-secondary hover:text-dash-ink">
          ← My Clients
        </Link>
        <h1 className="mt-2 text-[24px] font-bold text-dash-ink">{client.accountName}</h1>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-8">
          {/* Generate Report */}
          <div className="rounded-lg border border-dash-border border-l-4 border-l-dash-accent bg-dash-card p-6">
            <h2 className="text-[18px] font-semibold text-dash-ink">Generate New Report</h2>
            <p className="mt-1 text-[15px] text-dash-ink-secondary">
              Upload your campaign CSV to generate a branded report
            </p>
            <Link
              href={`/clients/${client.id}/reports/new`}
              className="mt-5 inline-block rounded-md bg-dash-accent px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-dash-accent-hover"
            >
              Generate Report
            </Link>
          </div>

          {/* Visual separator */}
          <div className="border-t border-dash-border" />

          {/* Recent Downloaded Reports */}
          <div>
            <h2 className="mb-4 text-[18px] font-semibold text-dash-ink">
              Recent Downloaded Reports ({reportItems.length})
            </h2>
            <ReportHistoryList clientId={client.id} initialReports={reportItems} />
          </div>
        </div>

        {/* Side panel — Client Settings */}
        <aside className="h-fit space-y-5 rounded-lg border border-dash-border bg-dash-card p-6">
          <h2 className="text-[18px] font-semibold text-dash-ink">Client Settings</h2>

          {client.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/clients/${client.id}/logo`}
              alt={`${client.accountName} logo`}
              className="h-[50px] w-[100px] rounded border border-dash-border bg-dash-bg object-contain"
            />
          )}

          <dl className="space-y-3 text-[15px]">
            <div>
              <dt className="text-[13px] text-dash-ink-secondary">Client name</dt>
              <dd className="text-dash-ink">{client.accountName}</dd>
            </div>
            <div>
              <dt className="text-[13px] text-dash-ink-secondary">Currency</dt>
              <dd className="text-dash-ink">
                {CURRENCY_SYMBOLS[client.currency]} {client.currency}
              </dd>
            </div>
            <div>
              <dt className="text-[13px] text-dash-ink-secondary">Timezone</dt>
              <dd className="text-dash-ink">{client.timezone}</dd>
            </div>
            <div>
              <dt className="text-[13px] text-dash-ink-secondary">Monthly budget</dt>
              <dd className="text-dash-ink">
                {client.monthlyBudget != null
                  ? `${CURRENCY_SYMBOLS[client.currency]}${client.monthlyBudget.toLocaleString("en-US")}`
                  : "Not set"}
              </dd>
            </div>
          </dl>

          <div className="flex items-center gap-3 pt-1">
            <Link
              href={`/clients/${client.id}/edit`}
              className="rounded-md border border-dash-secondary px-4 py-2 text-[14px] font-semibold text-dash-ink-secondary hover:bg-dash-secondary/20"
            >
              Edit Client
            </Link>
            <DeleteClientButton clientId={client.id} />
          </div>

          <div className="border-t border-dash-border pt-5">
            <h3 className="mb-2 text-[15px] font-semibold text-dash-ink">Previous Month Data</h3>
            <PreviousMonthDataUpload
              clientId={client.id}
              initialFileName={client.previousMonthDataUrl ? previousMonthDataFileName(client.previousMonthDataUrl) : null}
              initialUpdatedAt={client.previousMonthDataUpdatedAt?.toISOString() ?? null}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
