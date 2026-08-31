import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { ShareReportData } from "@/lib/nre/share-report";
import { ShareReportView } from "@/components/share-report-view";
import { verifyPdfRenderToken } from "@/lib/pdf/render-token";

export const metadata: Metadata = {
  title: "Report print — NextReport",
  robots: { index: false, follow: false },
};

export default async function PrintReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ sig?: string }>;
}) {
  const { token } = await params;
  const { sig } = await searchParams;
  if (!verifyPdfRenderToken(token, sig)) notFound();

  const report = await prisma.report.findUnique({ where: { shareToken: token } });
  if (!report || report.status !== "COMPLETE" || !report.summaryJson) notFound();

  let share: ShareReportData;
  try {
    const parsed = JSON.parse(report.summaryJson);
    if (parsed?.version !== 1 || !Array.isArray(parsed.campaigns)) notFound();
    share = parsed as ShareReportData;
  } catch {
    notFound();
  }

  if (!share.publishedAt) notFound();

  return <ShareReportView data={share} mode="print" />;
}
