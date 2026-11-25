import { IntegrationSettings } from "@/components/integration-settings";
import { ClientProviderSettings } from "@/components/client-provider-settings";
import { clientProviderSummaries } from "@/lib/client-provider-connections";
import { resolveClientUser } from "@/lib/client-provider-connections";
import { ClientReportDesign } from "@/components/client-report-design";
import { getVisitorCountryCode, isIndiaCountryCode } from "@/lib/visitor-geo";
import { SettingsDisclosure } from "@/components/settings-disclosure";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ClientForm } from "@/components/client-form";
import { DeleteClientButton } from "@/components/delete-client-button";
import { DuplicateClientButton } from "@/components/duplicate-client-button";
import { PreviousMonthDataUpload } from "@/components/previous-month-data-upload";
import { Ga4PropertyPicker } from "@/components/ga4-property-picker";
import { ReportHistoryList } from "@/components/report-history-list";
import { previousMonthDataFileName } from "@/lib/storage";
import {
  loadPreviousMonthDataCampaigns,
  loadPreviousMonthDataCampaignSpend,
  parsePreviousMonthSelectedCampaigns,
} from "@/lib/nre/previous-month-data";
import { CURRENCY_SYMBOLS } from "@/lib/nre/format";
import { defaultReportDisplayName } from "@/lib/nre/report-display-name";
import {
  DEFAULT_REPORT_RETENTION_DAYS,
  normalizeReportRetentionDays,
  purgeExpiredReportsForUser,
} from "@/lib/report-retention";
import { getSubscriptionStatus } from "@/lib/subscription";
import {
  isGoogleAdsApiConfigured,
  isGa4ApiConfigured,
  isMetaApiConfigured,
  isTikTokApiConfigured,
} from "@/lib/integrations-config";
import { isClientPlatformConnectionVisible } from "@/lib/meta-launch-scope";
import { WizardReturnBanner } from "@/components/wizard-return-banner";

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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string; [key: string]: string | undefined }>;
}) {
  const { id } = await params;
  const connectionParams = await searchParams;
  const { returnTo } = connectionParams;
  const connectionFailed = Object.keys(connectionParams).some(key => key.endsWith("_error") && !!connectionParams[key]);
  const connectionSaved = Object.keys(connectionParams).some(key => key.endsWith("_connected") && connectionParams[key] === "1");
  const session = await auth();
  if (!session?.user) notFound();
  const tiktokRegionRestricted = isIndiaCountryCode(await getVisitorCountryCode());

  const client = await prisma.client.findUnique({ where: { id } });
  if (!client || client.userId !== session.user.id) notFound();

  await purgeExpiredReportsForUser(session.user.id).catch(() => undefined);

  const [reports, reportCount, rawOwner] = await Promise.all([
    prisma.report.findMany({
      where: { clientId: client.id },
      orderBy: { createdAt: "desc" },
      take: RECENT_REPORTS_LIMIT,
    }),
    prisma.report.count({ where: { clientId: client.id } }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        slackWebhookUrl: true, automationWebhookUrl: true,
        googleRefreshToken: true, googleConnectedEmail: true,
        metaAdsEnabled: true, metaAccessToken: true,
        metaConnectedUserId: true,
        metaConnectedName: true,
        googleAdsRefreshToken: true,
        googleAdsEnabled: true,
        googleAdsConnectedEmail: true,
        ga4RefreshToken: true,
        ga4Enabled: true,
        ga4ConnectedEmail: true,
        tiktokRefreshToken: true, tiktokAccessToken: true,
        reportRetentionDays: true,
        planId: true,
        trialEndsAt: true, paidThrough: true, emailVerified: true,
        email: true,
        tiktokAdsEnabled: true,
        tiktokConnectedName: true,
      },
    }),
  ]);

  const owner = await resolveClientUser(rawOwner, client);
  const connectionSummaries = (await clientProviderSummaries(rawOwner ?? {}, client)).map(c => ({...c, configured: c.provider === "meta" ? isMetaApiConfigured() : c.provider === "ga4" ? isGa4ApiConfigured() : c.provider === "google-ads" ? isGoogleAdsApiConfigured() : c.provider === "tiktok" ? isTikTokApiConfigured() && !tiktokRegionRestricted : !!process.env.AUTH_GOOGLE_ID && !!process.env.AUTH_GOOGLE_SECRET}));
  const reportRetentionDays = owner
    ? normalizeReportRetentionDays(owner.reportRetentionDays, getSubscriptionStatus(owner).planId)
    : DEFAULT_REPORT_RETENTION_DAYS;

  let previousMonthCampaigns: string[] = [];
  let previousMonthCampaignSpend: Record<string, number> = {};
  if (client.previousMonthDataUrl) {
    try {
      previousMonthCampaigns = await loadPreviousMonthDataCampaigns(client.previousMonthDataUrl, client.timezone);
      previousMonthCampaignSpend = await loadPreviousMonthDataCampaignSpend(client.previousMonthDataUrl, client.timezone);
    } catch {
      previousMonthCampaigns = [];
      previousMonthCampaignSpend = {};
    }
  }
  const previousMonthSelectedCampaigns = parsePreviousMonthSelectedCampaigns(client.previousMonthSelectedCampaigns);

  const reportItems = reports.map((r) => ({
    id: r.id,
    fileName: r.fileName,
    weekStart: r.weekStart,
    weekEnd: r.weekEnd,
    status: r.status,
    reportType: r.reportType,
    createdAt: r.createdAt.toISOString(),
    approvalPending: r.requiresApproval && !r.approvedAt,
    shareToken: r.requiresApproval && !r.approvedAt ? null : r.shareToken,
    displayName: r.displayName ?? defaultReportDisplayName(r.reportType, r.weekStart, r.weekEnd),
  }));

  const ga4Connected = !!owner?.ga4RefreshToken && !!owner?.ga4Enabled;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Link href="/clients" className="text-[15px] text-dash-ink-secondary hover:text-dash-ink">
          ← Back to Clients
        </Link>
        <h1 className="mt-2 truncate text-[24px] font-bold text-dash-ink">{client.accountName}</h1>
        <p className="mt-0.5 text-[14px] text-dash-ink-secondary">Client settings · {client.currency} · {client.timezone}</p>
      </div>

      {connectionFailed && <p role="alert" className="mb-4 rounded-xl border border-dash-border p-4 text-sm text-dash-ink">Connection was not completed. Try connecting again and choose the login that has access to this client.</p>}
      {connectionSaved && <p role="status" className="mb-4 rounded-xl border border-dash-border p-4 text-sm text-dash-ink">Client connection saved. Choose its ad account, GA4 property or Drive folder before loading data or exporting.</p>}
      <WizardReturnBanner clientId={client.id} returnTo={returnTo} />

      <div className="space-y-4">
        <ClientProviderSettings clientId={client.id} connections={connectionSummaries}
          ga4Property={isClientPlatformConnectionVisible("ga4") ? (
            <div id="website-analytics" className="mt-4 scroll-mt-6 border-t border-dash-border pt-4">
              <h4 className="mb-2 text-sm font-semibold">Website property</h4>
              <Ga4PropertyPicker clientId={client.id} initialPropertyId={client.ga4PropertyId} initialPropertyName={client.ga4PropertyName} ga4Connected={ga4Connected} connectedEmail={owner?.ga4ConnectedEmail} embedded />
              <Link href={`/performance/google-analytics?client=${client.id}`} className="mt-3 inline-block text-xs font-medium text-dash-accent hover:underline">View website performance →</Link>
            </div>
          ) : null}
          automations={
            <details className="mt-4 rounded-xl border border-dash-border bg-dash-bg p-4">
              <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm font-semibold"><svg aria-hidden="true" className="shrink-0 text-dash-accent" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="2" y="8" width="6" height="6" rx="1.5"/><rect x="16" y="2" width="6" height="6" rx="1.5"/><rect x="16" y="16" width="6" height="6" rx="1.5"/><path d="M8 11h4V5h4M12 11v8h4"/></svg> Slack, Zapier &amp; Make <span className="rounded-full border border-dash-border px-2 py-1 text-[11px] font-normal text-dash-ink-secondary">Agency-wide</span></summary>
              <p className="my-3 text-xs text-dash-ink-secondary">These notification and automation settings apply to reports for all your clients.</p>
              <IntegrationSettings initialSlackWebhookUrl={rawOwner?.slackWebhookUrl ?? null} initialAutomationWebhookUrl={rawOwner?.automationWebhookUrl ?? null} />
            </details>
          }
        />

        <SettingsDisclosure id="client-settings" title="Client settings" hint="Name, currency, timezone, budget, logo and notes.">
          <ClientForm
            showTemplatePicker={false}
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
        </SettingsDisclosure>

        <ClientReportDesign clientId={client.id}/>

        <Card id="budget-monitor"><CardHeading hint="Review spending, budget alerts and campaign changes together in Performance.">Budget &amp; alerts</CardHeading><Link className="text-sm font-medium text-dash-accent hover:underline" href={`/performance/meta-ads?client=${client.id}#meta-budget-${client.id}`}>Open budget &amp; alerts →</Link></Card>


        <SettingsDisclosure id="previous-month-data" title="Previous month data" hint="Optional · add a month-over-month comparison when you need it.">
          <PreviousMonthDataUpload
            clientCurrency={client.currency}
            clientTimezone={client.timezone}
            clientId={client.id}
            initialFileName={client.previousMonthDataUrl ? previousMonthDataFileName(client.previousMonthDataUrl) : null}
            initialUpdatedAt={client.previousMonthDataUpdatedAt?.toISOString() ?? null}
            initialCampaigns={previousMonthCampaigns}
            initialSelectedCampaigns={previousMonthSelectedCampaigns}
            initialCampaignSpend={previousMonthCampaignSpend}
            currencySymbol={CURRENCY_SYMBOLS[client.currency] ?? "$"}
          />
        </SettingsDisclosure>

        {reportCount > 0 ? (
          <Card>
            <CardHeading
              hint={`Showing the latest ${RECENT_REPORTS_LIMIT}. Reports auto-delete after ${reportRetentionDays} days (change in Account settings).`}
            >
              Recent reports
            </CardHeading>
            <ReportHistoryList
              clientId={client.id}
              initialReports={reportItems}
              hasMoreReports={reportCount > reportItems.length}
              clientTimezone={client.timezone}
              clientCurrency={client.currency}
              reportRetentionDays={reportRetentionDays}
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
