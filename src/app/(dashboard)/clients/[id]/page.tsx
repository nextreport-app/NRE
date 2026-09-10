import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ClientForm } from "@/components/client-form";
import { DeleteClientButton } from "@/components/delete-client-button";
import { DuplicateClientButton } from "@/components/duplicate-client-button";
import { PreviousMonthDataUpload } from "@/components/previous-month-data-upload";
import { Ga4PropertyPicker } from "@/components/ga4-property-picker";
import { ClientPlatformConnections } from "@/components/client-platform-connections";
import { ReportHistoryList } from "@/components/report-history-list";
import { previousMonthDataFileName } from "@/lib/storage";
import { loadPreviousMonthDataCampaigns } from "@/lib/nre/previous-month-data";
import { defaultReportDisplayName } from "@/lib/nre/report-display-name";
import { purgeExpiredReports, REPORT_RETENTION_DAYS } from "@/lib/report-retention";
import {
  isGoogleAdsApiConfigured,
  isGa4ApiConfigured,
  isMetaApiConfigured,
  isTikTokApiConfigured,
} from "@/lib/integrations-config";

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
      select: {
        metaConnectedUserId: true,
        metaConnectedName: true,
        googleAdsRefreshToken: true,
        googleAdsEnabled: true,
        googleAdsConnectedEmail: true,
        ga4RefreshToken: true,
        ga4Enabled: true,
        ga4ConnectedEmail: true,
        tiktokRefreshToken: true,
        tiktokAdsEnabled: true,
        tiktokConnectedName: true,
      },
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

  const ga4Connected = !!owner?.ga4RefreshToken || !!owner?.ga4Enabled;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Link href="/clients" className="text-[15px] text-dash-ink-secondary hover:text-dash-ink">
          ← Back to Clients
        </Link>
        <h1 className="mt-2 truncate text-[24px] font-bold text-dash-ink">{client.accountName}</h1>
        <p className="mt-0.5 text-[15px] text-dash-ink-secondary">{client.currency}</p>
      </div>

      <div className="space-y-4">
        <Card id="platform-connections">
          <CardHeading hint="Account-level connections used by every client in the report wizard.">
            Platform connections
          </CardHeading>
          <ClientPlatformConnections
            meta={{
              connected: !!owner?.metaConnectedUserId,
              detail: owner?.metaConnectedName ?? null,
              configured: isMetaApiConfigured(),
            }}
            googleAds={{
              connected: !!owner?.googleAdsRefreshToken || !!owner?.googleAdsEnabled,
              detail: owner?.googleAdsConnectedEmail ?? null,
              configured: isGoogleAdsApiConfigured(),
            }}
            tiktok={{
              connected: !!owner?.tiktokRefreshToken || !!owner?.tiktokAdsEnabled,
              detail: owner?.tiktokConnectedName ?? null,
              configured: isTikTokApiConfigured(),
            }}
            ga4={{
              connected: ga4Connected,
              detail: owner?.ga4ConnectedEmail ?? null,
              configured: isGa4ApiConfigured(),
            }}
          />
        </Card>

        <Card id="previous-month-data">
          <CardHeading hint="Optional — adds a previous-month comparison row on Monthly overview slides.">
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
          <CardHeading hint="Pick one GA4 property for this client&rsquo;s Google Analytics reports.">
            Google Analytics property
          </CardHeading>
          <Ga4PropertyPicker
            clientId={client.id}
            initialPropertyId={client.ga4PropertyId}
            initialPropertyName={client.ga4PropertyName}
            ga4Connected={ga4Connected}
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
              monthlyBudget: client.monthlyBudget != null ? String(client.monthlyBudget) : "",
              template: client.template,
              notes: client.notes ?? "",
            }}
            hasLogo={!!client.logoUrl}
            submitLabel="Save Changes"
            savedMessage="Client settings saved"
            submitFullWidth
            inline
          />
          <div className="mt-4 flex flex-wrap items-center gap-x-2 border-t border-dash-border pt-4">
            <DuplicateClientButton clientId={client.id} clientName={client.accountName} />
            <span className="text-dash-ink-secondary" aria-hidden="true">
              ·
            </span>
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

        <Card accent id="generate-report">
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
      </div>
    </div>
  );
}
