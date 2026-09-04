import Link from "next/link";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { SupportTicketForm } from "@/components/support-ticket-form";

export const metadata: Metadata = {
  title: "Support",
  robots: { index: false, follow: false },
};

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; reportId?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) notFound();

  const params = await searchParams;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true },
  });
  if (!user) notFound();

  const clients = await prisma.client.findMany({
    where: { userId: session.user.id },
    select: { id: true, accountName: true },
    orderBy: { accountName: "asc" },
  });

  const reports = await prisma.report.findMany({
    where: { client: { userId: session.user.id } },
    select: { id: true, displayName: true, fileName: true, createdAt: true, client: { select: { accountName: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const reportOptions = reports.map((r) => ({
    id: r.id,
    label: `${r.client.accountName} — ${r.displayName ?? r.fileName ?? "Report"} (${r.createdAt.toLocaleDateString("en-IN")})`,
  }));

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold text-dash-ink">Raise a support ticket</h1>
      <p className="mt-2 text-sm text-dash-ink-secondary">
        Stuck on a step, seeing wrong metrics, or something doesn&apos;t look right in a report? Tell us what
        happened — we&apos;ll look at your account and get back to you quickly.
      </p>

      <div className="mt-8 rounded-lg border border-dash-border bg-dash-card p-6">
        <SupportTicketForm
          defaultName={user.name}
          defaultEmail={user.email}
          clients={clients}
          reports={reportOptions}
          defaultClientId={params.clientId}
          defaultReportId={params.reportId}
        />
      </div>

      <p className="mt-6 text-sm text-dash-ink-secondary">
        Prefer WhatsApp?{" "}
        <Link href="https://wa.me/918882578327" target="_blank" rel="noopener noreferrer" className="text-dash-accent hover:underline">
          Chat with us
        </Link>
        {" · "}
        Email{" "}
        <a href="mailto:hello@nextreport.in" className="text-dash-accent hover:underline">
          hello@nextreport.in
        </a>
      </p>
    </div>
  );
}
