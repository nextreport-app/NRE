import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ReportInbox } from "@/components/report-inbox";
import { ReportAreaNavigation } from "@/components/report-area-navigation";
import { clientActivityDate } from "@/lib/client-card-summary";
import { defaultReportDisplayName } from "@/lib/nre/report-display-name";
const PAGE_SIZE = 20;
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; page?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const sp = await searchParams;
  const scheduled = sp.tab === "scheduled";
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const where = {
    client: { userId: session.user.id },
    ...(q
      ? {
          OR: [
            { displayName: { contains: q, mode: "insensitive" as const } },
            {
              client: {
                accountName: { contains: q, mode: "insensitive" as const },
              },
            },
          ],
        }
      : {}),
  };
  const total = scheduled ? 0 : await prisma.report.count({ where });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const requested =
    typeof sp.page === "string" && /^\d+$/.test(sp.page)
      ? Math.min(10000, Math.max(1, Number(sp.page)))
      : 1;
  const page = Math.min(requested, pages);
  const reports = scheduled
    ? []
    : await prisma.report.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          status: true,
          displayName: true,
          reportType: true,
          createdAt: true,
          weekStart: true,
          weekEnd: true,
          requiresApproval: true,
          approvedAt: true,
          filePath: true,
          client: { select: { id: true, accountName: true, timezone: true } },
        },
      });
  const pageHref = (n: number) =>
    `/reports?${new URLSearchParams({ ...(q ? { q } : {}), page: String(n) })}`;
  const button =
    "inline-flex min-h-11 items-center justify-center rounded-xl border border-dash-border px-4 py-2 text-sm font-medium hover:bg-dash-card focus-visible:outline-2 focus-visible:outline-dash-accent";
  return (
    <div className="mx-auto max-w-5xl text-dash-ink">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="mt-2 text-sm text-dash-ink-secondary">
            Find generated reports or review scheduled drafts before sending.
          </p>
        </div>
        <Link href="/clients" className={button}>
          Generate a report
        </Link>
      </div>
      <ReportAreaNavigation current={scheduled ? "scheduled" : "history"} />
      {scheduled ? (
        <ReportInbox embedded />
      ) : (
        <>
          <form className="mb-4 flex flex-wrap gap-2" method="get">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Search reports or clients</span>
              <input
                name="q"
                defaultValue={q}
                placeholder="Search reports or clients…"
                maxLength={100}
                className="min-h-11 w-full rounded-xl border border-dash-border bg-dash-bg px-4 py-2 text-sm"
              />
            </label>
            <button className={button} type="submit">
              Search
            </button>
            {q && (
              <Link href="/reports" className={button}>
                Clear
              </Link>
            )}
          </form>
          <p className="mb-3 text-xs text-dash-ink-secondary">
            {total} report{total === 1 ? "" : "s"} · includes one-off and
            scheduled reports
          </p>
          {reports.length ? (
            <div className="space-y-3">
              {reports.map((report) => {
                const pendingApproval =
                  report.status === "COMPLETE" &&
                  report.requiresApproval &&
                  !report.approvedAt;
                const openHref = `/clients/${report.client.id}/reports/${report.id}/copy?from=${pendingApproval ? "scheduled" : "reports"}`;
                return (
                  <article
                    key={report.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dash-border bg-dash-card p-4"
                  >
                    <div className="min-w-0">
                      <p className="text-xs text-dash-ink-secondary">
                        {report.client.accountName}
                      </p>
                      <h2 className="mt-1 break-words text-sm font-semibold">
                        {report.displayName ??
                          defaultReportDisplayName(
                            report.reportType,
                            report.weekStart,
                            report.weekEnd,
                          )}
                      </h2>
                      <p className="mt-1 text-xs text-dash-ink-secondary">
                        <time
                          dateTime={report.createdAt.toISOString()}
                          title={report.client.timezone}
                        >
                          {clientActivityDate(
                            report.createdAt.toISOString(),
                            report.client.timezone,
                          )}
                        </time>{" "}
                        ·{" "}
                        {pendingApproval
                          ? "Awaiting approval"
                          : {
                              COMPLETE: "Complete",
                              PENDING: "Queued",
                              GENERATING: "Generating",
                              FAILED: "Failed",
                            }[report.status]}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {report.status === "COMPLETE" && report.filePath && (
                        <Link href={openHref} className={button}>
                          {pendingApproval ? "Review draft" : "Open report"}
                        </Link>
                      )}
                      <Link
                        href={`/clients/${report.client.id}/reports`}
                        className={button}
                      >
                        Client history
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dash-border bg-dash-card p-6 text-sm">
              <p>
                {q
                  ? "No reports match this search."
                  : "No reports generated yet."}
              </p>
              <Link
                href="/clients"
                className="mt-3 inline-block font-medium text-dash-accent"
              >
                Choose a client to generate a report →
              </Link>
            </div>
          )}
          {pages > 1 && (
            <nav
              aria-label="Report pages"
              className="mt-5 flex items-center justify-center gap-3"
            >
              {page > 1 && (
                <Link href={pageHref(page - 1)} className={button}>
                  Previous
                </Link>
              )}
              <span className="text-sm text-dash-ink-secondary">
                Page {page} of {pages}
              </span>
              {page < pages && (
                <Link href={pageHref(page + 1)} className={button}>
                  Next
                </Link>
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
