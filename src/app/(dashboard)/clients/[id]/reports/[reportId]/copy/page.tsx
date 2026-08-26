import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ReportShareReview } from "@/components/report-share-review";
import Link from "next/link";

export default async function ReportCopyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; reportId: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { id, reportId } = await params;
  const { from } = await searchParams;
  const report = await prisma.report.findUnique({ where: { id: reportId }, include: { client: true } });
  if (!report || report.client.userId !== session.user.id || report.clientId !== id) notFound();

  const fromGenerate = from === "generate";
  const backHref = fromGenerate ? `/clients/${id}/reports/new?resumeReport=${reportId}` : `/clients/${id}`;
  const backLabel = fromGenerate ? "← Back to Generate screen" : "← Back to client";

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <Link href={backHref} className="text-[13px] text-dash-accent hover:underline">
        {backLabel}
      </Link>
      <h1 className="text-[20px] font-semibold text-dash-ink">Review before sharing</h1>
      <ReportShareReview
        clientId={id}
        reportId={reportId}
        shareToken={report.shareToken}
        returnToGenerateHref={fromGenerate ? backHref : null}
      />
    </div>
  );
}
