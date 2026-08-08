import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ClientForm } from "@/components/client-form";
import { DeleteClientButton } from "@/components/delete-client-button";
import { PreviousMonthDataUpload } from "@/components/previous-month-data-upload";
import { ReportHistoryList } from "@/components/report-history-list";
import { previousMonthDataFileName } from "@/lib/storage";
import { loadPreviousMonthDataCampaigns } from "@/lib/nre/previous-month-data";

const REPORT_HISTORY_LIMIT = 10;

function CardHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-4 border-b border-dash-border pb-3 text-[16px] font-semibold text-dash-ink">{children}</h2>;
}

/** `accent` marks the single most important card on the page (Generate New Report) with an amber left border, per the two-column redesign's visual hierarchy. */
function Card({ children, accent = false }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <section
      className={
        "rounded-lg border border-dash-border bg-dash-card p-5" + (accent ? " border-l-4 border-l-dash-accent" : "")
      }
    >
      {children}
    </section>
  );
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

  const reports = await prisma.report.findMany({
    where: { clientId: client.id },
    orderBy: { createdAt: "desc" },
    take: REPORT_HISTORY_LIMIT,
  });

  // Part 1 — re-parsed server-side on every page load (rather than stored)
  // so the checkbox list's full universe always matches the file's actual
  // current contents, even if it was replaced outside this render. A
  // corrupt/unreadable file (rare — it already passed this same parse at
  // upload time) degrades to an empty list rather than failing the page.
  let previousMonthCampaigns: string[] = [];
  if (client.previousMonthDataUrl) {
    try {
      previousMonthCampaigns = await loadPreviousMonthDataCampaigns(client.previousMonthDataUrl);
    } catch {
      previousMonthCampaigns = [];
    }
  }
  const previousMonthSelectedCampaigns: string[] | null = client.previousMonthSelectedCampaigns
    ? (() => {
        try {
          const parsed = JSON.parse(client.previousMonthSelectedCampaigns!);
          return Array.isArray(parsed) ? parsed.filter((c): c is string => typeof c === "string") : null;
        } catch {
          return null;
        }
      })()
    : null;

  const reportItems = reports.map((r) => ({
    id: r.id,
    fileName: r.fileName,
    weekStart: r.weekStart,
    weekEnd: r.weekEnd,
    status: r.status,
    reportType: r.reportType,
    createdAt: r.createdAt.toISOString(),
    shareToken: r.shareToken,
  }));

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <Link href="/clients" className="text-[13px] text-dash-ink-secondary hover:text-dash-ink">
          ← My Clients
        </Link>
        <h1 className="mt-2 text-[24px] font-bold text-dash-ink">{client.accountName}</h1>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[3fr_2fr]">
        {/* Left column — primary action + report history */}
        <div className="space-y-4">
          <Card accent>
            <h2 className="mb-2 text-[18px] font-semibold text-dash-ink">Generate New Report</h2>
            <p className="text-[15px] text-dash-ink-secondary">
              Upload your MTD daily CSV to generate a branded performance report
            </p>
            <Link
              href={`/clients/${client.id}/reports/new`}
              className="mt-5 block w-full rounded-md bg-dash-accent px-6 py-3 text-center text-[14px] font-semibold text-dash-ink hover:bg-dash-accent-hover"
            >
              Generate Report
            </Link>
          </Card>

          <Card>
            <CardHeading>Recent Downloaded Reports ({reportItems.length})</CardHeading>
            <ReportHistoryList clientId={client.id} initialReports={reportItems} />
          </Card>
        </div>

        {/* Right column — client settings + previous month data */}
        <div className="space-y-4">
          <Card>
            <CardHeading>Client Settings</CardHeading>
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
              submitFullWidth
              inline
            />
            <div className="mt-4">
              <DeleteClientButton clientId={client.id} />
            </div>
          </Card>

          <Card>
            <CardHeading>Previous Month Data</CardHeading>
            <PreviousMonthDataUpload
              clientId={client.id}
              initialFileName={client.previousMonthDataUrl ? previousMonthDataFileName(client.previousMonthDataUrl) : null}
              initialUpdatedAt={client.previousMonthDataUpdatedAt?.toISOString() ?? null}
              initialCampaigns={previousMonthCampaigns}
              initialSelectedCampaigns={previousMonthSelectedCampaigns}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
