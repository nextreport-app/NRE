import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ReportCopyReview } from "@/components/report-copy-review";
import Link from "next/link";

export default async function ReportCopyPage({ params }: { params: Promise<{ id: string; reportId: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { id, reportId } = await params;
  const report = await prisma.report.findUnique({ where: { id: reportId }, include: { client: true } });
  if (!report || report.client.userId !== session.user.id || report.clientId !== id) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <Link href={`/clients/${id}`} className="text-[13px] text-dash-accent hover:underline">
        ← Back to client
      </Link>
      <h1 className="text-[20px] font-semibold text-dash-ink">Review report copy</h1>
      <ReportCopyReview clientId={id} reportId={reportId} />
    </div>
  );
}
