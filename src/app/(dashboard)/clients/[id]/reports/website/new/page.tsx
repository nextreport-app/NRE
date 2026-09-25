import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DeferredLaunchNotice } from "@/components/coming-soon-badge";

export default async function NewWebsiteReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) notFound();

  const client = await prisma.client.findUnique({ where: { id } });
  if (!client || client.userId !== session.user.id) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href={`/clients/${client.id}`}
          className="text-[14px] font-medium text-dash-accent underline hover:no-underline"
        >
          ← Back to {client.accountName}
        </Link>
        <h1 className="mt-3 text-[20px] font-bold text-dash-ink">Website Traffic Report</h1>
        <p className="mt-1 text-[14px] text-dash-ink-secondary">Google Analytics (GA4) website performance decks.</p>
      </div>
      <DeferredLaunchNotice />
      <p className="text-[14px] text-dash-ink-secondary">
        You can still connect GA4 in{" "}
        <Link href="/account#ga4" className="font-medium text-dash-accent underline hover:no-underline">
          Account settings
        </Link>{" "}
        and link a property on the client page — generation opens once Meta Ads reporting is fully launched.
      </p>
      <Link
        href={`/clients/${client.id}/reports/new`}
        className="inline-block rounded-md bg-dash-accent px-5 py-2.5 text-[14px] font-semibold text-dash-ink hover:bg-dash-accent-hover"
      >
        Generate Meta Ads report instead
      </Link>
    </div>
  );
}
