import Link from "next/link";
import { notFound } from "next/navigation";
import { isLaunchPlatformEnabled } from "@/lib/meta-launch-scope";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { WebsiteReportWizard } from "@/components/website-report-wizard";

export default async function NewWebsiteReportPage({ params }: { params: Promise<{ id: string }> }) {
  if (!isLaunchPlatformEnabled("GA4")) notFound();
  const { id } = await params;
  const session = await auth();
  if (!session?.user) notFound();

  const [client, user] = await Promise.all([
    prisma.client.findUnique({ where: { id } }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { ga4Enabled: true, ga4RefreshToken: true },
    }),
  ]);
  if (!client || client.userId !== session.user.id) notFound();
  if (!user) notFound();

  const ga4Connected = user.ga4Enabled && !!user.ga4RefreshToken;

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

      <WebsiteReportWizard
        clientId={client.id}
        clientName={client.accountName}
        hasGa4Property={!!client.ga4PropertyId}
        ga4Connected={ga4Connected}
      />
    </div>
  );
}
