import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { isAdminEmail } from "@/lib/subscription";

export const metadata = { title: "Support tickets (admin)", robots: { index: false, follow: false } };

function formatDate(d: Date) {
  return d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export default async function AdminSupportPage() {
  const session = await auth();
  if (!session?.user?.email || !isAdminEmail(session.user.email)) notFound();

  const tickets = await prisma.supportTicket.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: { select: { email: true, name: true } } },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-dash-ink">Support tickets</h1>
      <p className="mt-1 text-sm text-dash-ink-secondary">Latest 100 tickets from logged-in users.</p>

      {tickets.length === 0 ? (
        <p className="mt-8 text-sm text-dash-ink-muted">No tickets yet.</p>
      ) : (
        <ul className="mt-8 space-y-4">
          {tickets.map((t) => (
            <li key={t.id} className="rounded-lg border border-dash-border bg-dash-card p-5 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-dash-ink">{t.category}</p>
                  <p className="mt-0.5 text-dash-ink-secondary">
                    {t.name} · {t.email}
                    {t.phone ? ` · ${t.phone}` : ""}
                  </p>
                </div>
                <span className="rounded-full border border-dash-border px-2 py-0.5 text-xs text-dash-ink-muted">
                  {t.status}
                </span>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-dash-ink-secondary">{t.message}</p>
              <dl className="mt-3 grid gap-1 text-xs text-dash-ink-muted sm:grid-cols-2">
                <div>
                  <dt className="inline font-medium text-dash-ink-secondary">Plan: </dt>
                  <dd className="inline">{t.planId}</dd>
                </div>
                <div>
                  <dt className="inline font-medium text-dash-ink-secondary">Submitted: </dt>
                  <dd className="inline">{formatDate(t.createdAt)}</dd>
                </div>
                {t.clientName && (
                  <div>
                    <dt className="inline font-medium text-dash-ink-secondary">Client: </dt>
                    <dd className="inline">{t.clientName}</dd>
                  </div>
                )}
                {t.reportDisplayName && (
                  <div>
                    <dt className="inline font-medium text-dash-ink-secondary">Report: </dt>
                    <dd className="inline">{t.reportDisplayName}</dd>
                  </div>
                )}
                {t.attachmentFileName && (
                  <div className="sm:col-span-2">
                    <dt className="inline font-medium text-dash-ink-secondary">Attachment: </dt>
                    <dd className="inline">{t.attachmentFileName}</dd>
                  </div>
                )}
              </dl>
              <p className="mt-2 text-xs text-dash-ink-muted">
                Account: {t.user.email} · Ticket ID: {t.id}
              </p>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-8 text-sm">
        <Link href="/clients" className="text-dash-accent hover:underline">
          ← Back to dashboard
        </Link>
      </p>
    </div>
  );
}
