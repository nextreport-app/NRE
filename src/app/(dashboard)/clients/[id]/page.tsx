import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ClientForm } from "@/components/client-form";
import { DeleteClientButton } from "@/components/delete-client-button";
import { DuplicateClientButton } from "@/components/duplicate-client-button";
import { PreviousMonthDataUpload } from "@/components/previous-month-data-upload";
import { ReportHistoryList } from "@/components/report-history-list";
import { previousMonthDataFileName } from "@/lib/storage";
import { loadPreviousMonthDataCampaigns } from "@/lib/nre/previous-month-data";
import { defaultReportDisplayName } from "@/lib/nre/report-display-name";
import { CURRENCY_SYMBOLS } from "@/lib/nre/format";
import { TEMPLATE_LABELS, TIMEZONE_GROUPS } from "@/lib/validators/client";

const REPORT_HISTORY_LIMIT = 10;

function CardHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-4 border-b border-dash-border pb-3 text-[16px] font-semibold text-dash-ink">{children}</h2>;
}

/** `accent` marks the single most important card on the page (Generate New Report) with an amber left border, per the three-section redesign's visual hierarchy. */
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

function PencilIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-[13px]">
      <span className="text-dash-ink-secondary">{label}</span>
      <span className="text-right text-dash-ink">{value}</span>
    </div>
  );
}

function formatBudget(currency: string, budget: number | null): string {
  if (budget == null) return "Not set";
  return `${CURRENCY_SYMBOLS[currency as keyof typeof CURRENCY_SYMBOLS]}${budget.toLocaleString("en-US")}`;
}

/** IANA value -> "City (ABBR)" display label, from TIMEZONE_GROUPS' own option labels — falls back to the raw value for anything not in that (already-exhaustive) list. */
function timezoneLabel(value: string): string {
  for (const group of TIMEZONE_GROUPS) {
    const match = group.zones.find((z) => z.value === value);
    if (match) return match.label;
  }
  return value;
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

  const [reports, reportCount] = await Promise.all([
    prisma.report.findMany({
      where: { clientId: client.id },
      orderBy: { createdAt: "desc" },
      take: REPORT_HISTORY_LIMIT,
    }),
    prisma.report.count({ where: { clientId: client.id } }),
  ]);

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
    displayName: r.displayName ?? defaultReportDisplayName(r.reportType, r.weekStart, r.weekEnd),
  }));

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4">
        <Link href="/clients" className="text-[13px] text-dash-ink-secondary hover:text-dash-ink">
          ← Back to Clients
        </Link>
      </div>

      {/* Row 1 — full-width header bar: name (+ jump-to-edit link, no JS
          needed — `#account-name-input` matches the id ClientForm puts on
          its Account Name field, and fragment navigation both scrolls to
          and focuses a focusable target) and the two account-level actions,
          moved here from inside the Client Settings card below. */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h1 className="text-[24px] font-bold text-dash-ink">{client.accountName}</h1>
            <a
              href="#account-name-input"
              title="Edit account name in Client Settings"
              aria-label="Edit account name"
              className="text-dash-ink-secondary hover:text-dash-accent"
            >
              <PencilIcon />
            </a>
          </div>
          <div className="flex items-center gap-4">
            <DuplicateClientButton clientId={client.id} clientName={client.accountName} />
            <DeleteClientButton clientId={client.id} />
          </div>
        </div>
      </Card>

      {/* Row 2 — three columns (30% / 40% / 30%). Each column is one grid
          item so mobile stacking (grid-cols-1) and desktop 3-up placement
          share the same DOM — only the `order` differs per breakpoint
          (md:order-none resets all three to source order: Settings,
          Generate, Previous Month Data). Rendering each section once here
          — rather than duplicating the JSX for a separate mobile layout —
          matters because ClientForm/PreviousMonthDataUpload/
          ReportHistoryList are stateful Client Components; a duplicate
          instance would double-mount them (double fetches, double toasts). */}
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[3fr_4fr_3fr]">
        {/* Left (30%) — Client Settings. Mobile order 3 (after Generate and
            Previous Month Data), matching the requested mobile stack. */}
        <div className="order-3 space-y-4 md:order-none">
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
                notes: client.notes ?? "",
              }}
              hasLogo={!!client.logoUrl}
              submitLabel="Save Changes"
              savedMessage="Client settings saved"
              submitFullWidth
              inline
            />
          </Card>
        </div>

        {/* Centre (40%) — Generate New Report, the primary action; mobile order 1 (first). */}
        <div className="order-1 space-y-4 md:order-none">
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
        </div>

        {/* Right (30%) — Previous Month Data on top, Account Info summary
            below it. Mobile order 2 (right after Generate). */}
        <div className="order-2 space-y-4 md:order-none">
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

          <Card>
            <CardHeading>Account Info</CardHeading>
            <div className="divide-y divide-dash-border">
              <InfoRow label="Currency" value={client.currency} />
              <InfoRow label="Timezone" value={timezoneLabel(client.timezone)} />
              <InfoRow label="Monthly Budget" value={formatBudget(client.currency, client.monthlyBudget)} />
              <InfoRow label="Template" value={TEMPLATE_LABELS[client.template]} />
            </div>
          </Card>
        </div>
      </div>

      {/* Row 3 — full-width Recent Downloaded Reports, last on mobile too. */}
      <div className="mt-4">
        <Card>
          <CardHeading>Recent Downloaded Reports ({reportItems.length})</CardHeading>
          <ReportHistoryList clientId={client.id} initialReports={reportItems} hasMoreReports={reportCount > reportItems.length} />
        </Card>
      </div>
    </div>
  );
}
