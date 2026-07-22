import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ReportUploadWizard } from "@/components/report-upload-wizard";

export default async function NewReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) notFound();

  const client = await prisma.client.findUnique({ where: { id } });
  if (!client || client.userId !== session.user.id) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-xl font-semibold text-white">Generate report</h1>
      <p className="mb-6 text-sm text-slate-400">{client.accountName}</p>
      <ReportUploadWizard clientId={client.id} />
    </div>
  );
}
