import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { isAdminEmail } from "@/lib/subscription";

export const metadata = { title: "Product metrics (admin)", robots: { index: false, follow: false } };

function formatDate(d: Date) {
  return d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export default async function AdminMetricsPage() {
  const session = await auth();
  if (!session?.user?.email || !isAdminEmail(session.user.email)) notFound();

  const [signupCount, completeReportCount, activatedUserCount, users] = await Promise.all([
    prisma.user.count(),
    prisma.report.count({ where: { status: "COMPLETE" } }),
    prisma.user.count({
      where: { clients: { some: { reports: { some: { status: "COMPLETE" } } } } },
    }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 150,
      select: {
        email: true,
        name: true,
        createdAt: true,
        clients: {
          select: {
            reports: {
              where: { status: "COMPLETE" },
              orderBy: { createdAt: "asc" },
              select: { createdAt: true },
            },
          },
        },
      },
    }),
  ]);

  const rows = users.map((user) => {
    const completed = user.clients.flatMap((c) => c.reports);
    const reportCount = completed.length;
    const firstReportAt = completed[0]?.createdAt ?? null;
    return {
      email: user.email,
      name: user.name,
      signedUpAt: user.createdAt,
      reportCount,
      firstReportAt,
    };
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-dash-ink">Product metrics</h1>
          <p className="mt-1 text-sm text-dash-ink-secondary">
            Signups, first completed reports, and report volume (admin only).
          </p>
        </div>
        <Link href="/admin/support" className="text-sm font-medium text-dash-accent hover:underline">
          Support tickets →
        </Link>
      </div>

      <dl className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-dash-border bg-dash-card p-4">
          <dt className="text-xs font-semibold uppercase tracking-wide text-dash-ink-muted">Signups</dt>
          <dd className="mt-1 text-2xl font-bold text-dash-ink">{signupCount}</dd>
        </div>
        <div className="rounded-lg border border-dash-border bg-dash-card p-4">
          <dt className="text-xs font-semibold uppercase tracking-wide text-dash-ink-muted">Users with ≥1 report</dt>
          <dd className="mt-1 text-2xl font-bold text-dash-ink">{activatedUserCount}</dd>
        </div>
        <div className="rounded-lg border border-dash-border bg-dash-card p-4">
          <dt className="text-xs font-semibold uppercase tracking-wide text-dash-ink-muted">Completed reports</dt>
          <dd className="mt-1 text-2xl font-bold text-dash-ink">{completeReportCount}</dd>
        </div>
      </dl>

      <div className="mt-10 overflow-x-auto rounded-lg border border-dash-border">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-dash-border bg-dash-card text-xs uppercase tracking-wide text-dash-ink-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">User</th>
              <th className="px-4 py-3 font-semibold">Signed up</th>
              <th className="px-4 py-3 font-semibold">Reports</th>
              <th className="px-4 py-3 font-semibold">First report</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.email} className="border-b border-dash-border last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium text-dash-ink">{row.email}</p>
                  {row.name ? <p className="text-dash-ink-secondary">{row.name}</p> : null}
                </td>
                <td className="px-4 py-3 text-dash-ink-secondary">{formatDate(row.signedUpAt)}</td>
                <td className="px-4 py-3 text-dash-ink">{row.reportCount}</td>
                <td className="px-4 py-3 text-dash-ink-secondary">
                  {row.firstReportAt ? formatDate(row.firstReportAt) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-dash-ink-muted">Showing latest 150 signups. Filter in SQL/Prisma Studio for full exports.</p>
    </div>
  );
}
