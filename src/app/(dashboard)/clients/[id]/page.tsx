import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ClientForm } from "@/components/client-form";
import { DeleteClientButton } from "@/components/delete-client-button";
import { PreviousMonthDataUpload } from "@/components/previous-month-data-upload";
import { ReportHistoryList } from "@/components/report-history-list";
import { previousMonthDataFileName } from "@/lib/storage";

const REPORT_HISTORY_DAYS = 30;

/** Kept outside the component body — react-hooks/purity flags Date.now() called directly during render, even in an async Server Component that only ever runs once per request. */
function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-4 border-b border-dash-border pb-3 text-[16px] font-semibold text-dash-ink">{children}</h2>;
}

function Section({ children }: { children: React.ReactNode }) {
  return <section className="rounded-lg border border-dash-border bg-dash-card p-6">{children}</section>;
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
    <div className="mx-auto max-w-2xl">
      <div className="mb-8">
        <Link href="/clients" className="text-[13px] text-dash-ink-secondary hover:text-dash-ink">
          ← My Clients
        </Link>
        <h1 className="mt-2 text-[24px] font-bold text-dash-ink">{client.accountName}</h1>
      </div>

      <div className="space-y-8">
        {/* Section 1 — Client Settings */}
        <Section>
          <SectionHeading>Client Settings</SectionHeading>
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
            submitLabel="Save Changes"
            savedMessage="Client settings saved"
            inline
          />
          <div className="mt-6 border-t border-dash-border pt-6">
            <DeleteClientButton clientId={client.id} />
          </div>
        </Section>

        {/* Section 2 — Previous Month Data */}
        <Section>
          <SectionHeading>Previous Month Data</SectionHeading>
          <PreviousMonthDataUpload
            clientId={client.id}
            initialFileName={client.previousMonthDataUrl ? previousMonthDataFileName(client.previousMonthDataUrl) : null}
            initialUpdatedAt={client.previousMonthDataUpdatedAt?.toISOString() ?? null}
          />
        </Section>

        {/* Section 3 — Generate New Report */}
        <Section>
          <SectionHeading>Generate New Report</SectionHeading>
          <p className="text-[15px] text-dash-ink-secondary">
            Upload your MTD daily CSV to generate a branded performance report
          </p>
          <Link
            href={`/clients/${client.id}/reports/new`}
            className="mt-5 inline-block rounded-md bg-dash-accent px-6 py-3 text-[14px] font-semibold text-dash-ink hover:bg-dash-accent-hover"
          >
            Generate Report
          </Link>
        </Section>

        {/* Section 4 — Recent Downloaded Reports */}
        <Section>
          <SectionHeading>Recent Downloaded Reports ({reportItems.length})</SectionHeading>
          <ReportHistoryList clientId={client.id} initialReports={reportItems} />
        </Section>
      </div>
    </div>
  );
}
