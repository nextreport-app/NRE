import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { defaultReportDisplayName } from "@/lib/nre/report-display-name";
import { FullReportHistoryList } from "@/components/full-report-history-list";

const PAGE_SIZE = 20;
const REPORT_TYPES = ["WEEKLY", "MONTHLY", "COMPARISON"] as const;

type SearchParams = { page?: string; type?: string; from?: string; to?: string };

function isValidReportType(value: string | undefined): value is (typeof REPORT_TYPES)[number] {
  return !!value && (REPORT_TYPES as readonly string[]).includes(value);
}

/** Builds a `/clients/[id]/reports?...` query string, keeping the current filters unless overridden — used by the filter form's own fields (via defaultValue, not this) and the pagination links below. */
function buildHref(clientId: string, sp: SearchParams, overrides: Partial<SearchParams>) {
  const merged = { ...sp, ...overrides };
  const params = new URLSearchParams();
  if (merged.type && merged.type !== "ALL") params.set("type", merged.type);
  if (merged.from) params.set("from", merged.from);
  if (merged.to) params.set("to", merged.to);
  if (merged.page && merged.page !== "1") params.set("page", merged.page);
  const qs = params.toString();
  return `/clients/${clientId}/reports${qs ? `?${qs}` : ""}`;
}

/**
 * Feature 1 — full report history (every report ever generated for this
 * client, not just the Manage page's most-recent-10). Filtering/pagination
 * are plain GET query params handled entirely server-side (no client JS
 * needed for either) — only the row-level actions (select/delete/rename/
 * share) need interactivity, which is what FullReportHistoryList is for.
 */
export default async function ClientAllReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) notFound();

  const client = await prisma.client.findUnique({ where: { id } });
  if (!client || client.userId !== session.user.id) notFound();

  const typeFilter = isValidReportType(sp.type) ? sp.type : undefined;
  const fromFilter = sp.from ? new Date(`${sp.from}T00:00:00`) : undefined;
  const toFilter = sp.to ? new Date(`${sp.to}T23:59:59.999`) : undefined;
  const validFromFilter = fromFilter && !Number.isNaN(fromFilter.getTime()) ? fromFilter : undefined;
  const validToFilter = toFilter && !Number.isNaN(toFilter.getTime()) ? toFilter : undefined;

  const where = {
    clientId: client.id,
    ...(typeFilter ? { reportType: typeFilter } : {}),
    ...(validFromFilter || validToFilter
      ? {
          createdAt: {
            ...(validFromFilter ? { gte: validFromFilter } : {}),
            ...(validToFilter ? { lte: validToFilter } : {}),
          },
        }
      : {}),
  };

  const requestedPage = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const [total, reports] = await Promise.all([
    prisma.report.count({ where }),
    prisma.report.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (requestedPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  const monthFormatter = new Intl.DateTimeFormat("en-US", { timeZone: client.timezone, month: "long", year: "numeric" });

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
    monthLabel: monthFormatter.format(r.createdAt),
  }));

  const hasActiveFilters = !!(typeFilter || sp.from || sp.to);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <Link href={`/clients/${client.id}`} className="text-[13px] text-dash-ink-secondary hover:text-dash-ink">
          ← Back to {client.accountName}
        </Link>
        <h1 className="mt-2 text-[24px] font-bold text-dash-ink">All Reports</h1>
        <p className="mt-1 text-[15px] text-dash-ink-secondary">
          {client.accountName} · {total} report{total === 1 ? "" : "s"}
        </p>
      </div>

      <form method="get" className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-dash-border bg-dash-card p-4">
        <div>
          <label className="mb-1 block text-[13px] text-dash-ink-secondary">Report type</label>
          <select
            name="type"
            defaultValue={typeFilter ?? "ALL"}
            className="rounded-md border border-dash-border bg-dash-bg px-3 py-2 text-[13px] text-dash-ink outline-none focus:border-dash-accent"
          >
            <option value="ALL">All types</option>
            <option value="WEEKLY">Weekly</option>
            <option value="MONTHLY">Monthly</option>
            <option value="COMPARISON">Comparison</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[13px] text-dash-ink-secondary">From</label>
          <input
            type="date"
            name="from"
            defaultValue={sp.from ?? ""}
            className="rounded-md border border-dash-border bg-dash-bg px-3 py-2 text-[13px] text-dash-ink outline-none focus:border-dash-accent"
          />
        </div>
        <div>
          <label className="mb-1 block text-[13px] text-dash-ink-secondary">To</label>
          <input
            type="date"
            name="to"
            defaultValue={sp.to ?? ""}
            className="rounded-md border border-dash-border bg-dash-bg px-3 py-2 text-[13px] text-dash-ink outline-none focus:border-dash-accent"
          />
        </div>
        <button type="submit" className="rounded-md bg-dash-accent px-4 py-2 text-[13px] font-semibold text-dash-ink hover:bg-dash-accent-hover">
          Filter
        </button>
        {hasActiveFilters && (
          <Link href={`/clients/${client.id}/reports`} className="text-[13px] text-dash-ink-secondary hover:underline">
            Clear filters
          </Link>
        )}
      </form>

      {reportItems.length === 0 ? (
        <p className="text-[15px] text-dash-ink-secondary">
          {hasActiveFilters ? "No reports match these filters." : "No reports yet."}
        </p>
      ) : (
        <FullReportHistoryList clientId={client.id} initialReports={reportItems} />
      )}

      {totalPages > 1 && (
        <div className="mt-5 flex items-center justify-center gap-4 text-[13px]">
          {currentPage > 1 ? (
            <Link
              href={buildHref(client.id, sp, { page: String(currentPage - 1) })}
              className="rounded-md border border-dash-border px-3 py-1.5 text-dash-ink hover:bg-dash-card"
            >
              ← Previous
            </Link>
          ) : (
            <span className="rounded-md border border-dash-border px-3 py-1.5 text-dash-ink-secondary opacity-50">← Previous</span>
          )}
          <span className="text-dash-ink-secondary">
            Page {currentPage} of {totalPages}
          </span>
          {currentPage < totalPages ? (
            <Link
              href={buildHref(client.id, sp, { page: String(currentPage + 1) })}
              className="rounded-md border border-dash-border px-3 py-1.5 text-dash-ink hover:bg-dash-card"
            >
              Next →
            </Link>
          ) : (
            <span className="rounded-md border border-dash-border px-3 py-1.5 text-dash-ink-secondary opacity-50">Next →</span>
          )}
        </div>
      )}
    </div>
  );
}
