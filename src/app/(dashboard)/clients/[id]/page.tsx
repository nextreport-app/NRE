import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ClientForm } from "@/components/client-form";
import { DeleteClientButton } from "@/components/delete-client-button";
import { DuplicateClientButton } from "@/components/duplicate-client-button";
import { ResetObjectiveMemoryButton } from "@/components/reset-objective-memory-button";
import { PreviousMonthDataUpload } from "@/components/previous-month-data-upload";
import { Ga4PropertyPicker } from "@/components/ga4-property-picker";
import { ReportHistoryList } from "@/components/report-history-list";
import { previousMonthDataFileName } from "@/lib/storage";
import { loadPreviousMonthDataCampaigns } from "@/lib/nre/previous-month-data";
import { defaultReportDisplayName } from "@/lib/nre/report-display-name";
import { getPreviousMonthListStatus } from "@/lib/client-display";
import { purgeExpiredReports, REPORT_RETENTION_DAYS } from "@/lib/report-retention";

const RECENT_REPORTS_LIMIT = 5;

function CardHeading({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-4 border-b border-dash-border pb-3">
      <h2 className="text-[17px] font-semibold text-dash-ink">{children}</h2>
      {hint ? <p className="mt-1 text-[14px] text-dash-ink-secondary">{hint}</p> : null}
    </div>
  );
}

function Card({ children, accent = false, id }: { children: React.ReactNode; accent?: boolean; id?: string }) {
  return (
    <section
      id={id}
      className={
        "rounded-xl border border-dash-border bg-dash-card p-4 sm:p-5" +
        (accent ? " border-l-4 border-l-dash-accent" : "")
      }
    >
      {children}
    </section>
  );
}

function SetupStatusChip({
  tone,
  label,
}: {
  tone: "good" | "warn" | "neutral";
  label: string;
}) {
  const cls =
    tone === "good"
      ? "border-emerald-800/50 bg-emerald-950/30 text-emerald-200"
      : tone === "warn"
        ? "border-amber-800/50 bg-amber-950/30 text-amber-200"
        : "border-dash-border bg-dash-bg text-dash-ink-secondary";
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[13px] font-medium ${cls}`}>{label}</span>
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

  await purgeExpiredReports().catch(() => undefined);

  const client = await prisma.client.findUnique({ where: { id } });
  if (!client || client.userId !== session.user.id) notFound();

  const [reports, reportCount, owner] = await Promise.all([
    prisma.report.findMany({
      where: { clientId: client.id },
      orderBy: { createdAt: "desc" },
      take: RECENT_REPORTS_LIMIT,
    }),
    prisma.report.count({ where: { clientId: client.id } }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { ga4Enabled: true, ga4RefreshToken: true },
    }),
  ]);

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

  const prevMonth = getPreviousMonthListStatus(
    !!client.previousMonthDataUrl,
    client.previousMonthDataUpdatedAt?.toISOString() ?? null,
    client.timezone,
  );

  const reportItems = reports.map((r) => ({
    id: r.id,
    fileName: r.fileName,
    weekStart: r.weekStart,
    weekEnd: r.weekEnd,
    status: r.status,
    reportType: r.reportType,
    createdAt: r.createdAt.toISOString(),
    shareToken: r.shareToken,
    displayName: r.displayName ?? defaultReportDisplayName(r.reportType, r.weekStart, r.weekEnd),
  }));

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Link href="/clients" className="text-[15px] text-dash-ink-secondary hover:text-dash-ink">
          ← Back to Clients
        </Link>
        <h1 className="mt-2 truncate text-[24px] font-bold text-dash-ink">{client.accountName}</h1>
        <p className="mt-0.5 text-[15px] text-dash-ink-secondary">{client.currency}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <SetupStatusChip
            tone={prevMonth.status === "current" ? "good" : "warn"}
            label={prevMonth.label}
          />
          <SetupStatusChip
            tone={client.ga4PropertyId ? "good" : "neutral"}
            label={client.ga4PropertyId ? "GA4 linked" : "GA4 not linked"}
          />
        </div>
      </div>

      <div className="space-y-4">
        <Card accent>
          <CardHeading hint="Meta, Google Ads, TikTok, and Google Analytics — all in one wizard.">
            Generate report
          </CardHeading>
          <Link
            href={`/clients/${client.id}/reports/new`}
            className="block w-full rounded-md bg-dash-accent px-6 py-3 text-center text-[15px] font-semibold text-dash-ink hover:bg-dash-accent-hover"
          >
            Generate Report
          </Link>
        </Card>

        <Card id="previous-month-data">
          <CardHeading hint="Optional — adds a previous-month row on Monthly overview slides.">
            Previous month data
          </CardHeading>
          <PreviousMonthDataUpload
            clientId={client.id}
            initialFileName={client.previousMonthDataUrl ? previousMonthDataFileName(client.previousMonthDataUrl) : null}
            initialUpdatedAt={client.previousMonthDataUpdatedAt?.toISOString() ?? null}
            initialCampaigns={previousMonthCampaigns}
            initialSelectedCampaigns={previousMonthSelectedCampaigns}
          />
        </Card>

        <Card id="website-analytics">
          <CardHeading hint="Required only for Google Analytics reports.">
            Google Analytics
          </CardHeading>
          <Ga4PropertyPicker
            clientId={client.id}
            initialPropertyId={client.ga4PropertyId}
            initialPropertyName={client.ga4PropertyName}
            ga4Connected={!!owner?.ga4RefreshToken || !!owner?.ga4Enabled}
          />
        </Card>

        <Card>
          <CardHeading>Client settings</CardHeading>
          <ClientForm
            clientId={client.id}
            initial={{
              accountName: client.accountName,
              currency: client.currency,
              timezone: client.timezone,
              monthlyBudget: client.monthlyBudget,
              template: client.template,
              notes: client.notes ?? "",
            }}
            hasLogo={!!client.logoUrl}
            submitLabel="Save Changes"
            savedMessage="Client settings saved"
            submitFullWidth
            inline
          />
          <div className="mt-4 space-y-2 border-t border-dash-border pt-4">
            <ResetObjectiveMemoryButton clientId={client.id} />
            <DuplicateClientButton clientId={client.id} clientName={client.accountName} />
            <DeleteClientButton clientId={client.id} />
          </div>
        </Card>

        {reportCount > 0 ? (
          <Card>
            <CardHeading
              hint={`Showing the latest ${RECENT_REPORTS_LIMIT}. Reports auto-delete after ${REPORT_RETENTION_DAYS} days.`}
            >
              Recent reports
            </CardHeading>
            <ReportHistoryList
              clientId={client.id}
              initialReports={reportItems}
              hasMoreReports={reportCount > reportItems.length}
            />
            {reportCount > reportItems.length ? (
              <Link
                href={`/clients/${client.id}/reports`}
                className="mt-4 inline-block text-[15px] font-medium text-dash-accent underline hover:no-underline"
              >
                View all {reportCount} reports →
              </Link>
            ) : null}
          </Card>
        ) : null}
      </div>
    </div>
  );
}
