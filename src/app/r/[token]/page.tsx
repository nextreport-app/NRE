import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type { ShareReportData } from "@/lib/nre/share-report";
import { isShareWebsiteReportData, type ShareWebsiteReportData } from "@/lib/nre/share-website-report";
import { ShareReportView, reportTypeLabel } from "@/components/share-report-view";
import { ShareWebsiteReportView, websiteReportTypeLabel } from "@/components/share-website-report-view";

type SharedReportPayload =
  | { kind: "ads"; data: ShareReportData }
  | { kind: "website"; data: ShareWebsiteReportData };

/**
 * Public, read-only, no-login report page — a client-shareable alternative
 * to the PPTX download. Reached only via an unguessable 12-character token
 * (lib/share-token.ts); see proxy.ts, which allowlists /r/ as a public
 * path. Everything rendered here comes straight out of Report.summaryJson
 * (lib/nre/share-report.ts's ShareReportData), already computed at report-
 * generation time — this page does no NRE aggregation of its own. The
 * actual presentational tree lives in components/share-report-view.tsx so
 * it can also be rendered from a fixture, independent of this DB lookup.
 *
 * cache() dedupes the DB lookup between generateMetadata and the page
 * component below, which both need the same report within one request.
 */
const getReportByToken = cache(async (token: string): Promise<SharedReportPayload | null> => {
  const report = await prisma.report.findUnique({ where: { shareToken: token } });
  if (!report || report.status !== "COMPLETE" || !report.summaryJson) return null;
  try {
    const parsed = JSON.parse(report.summaryJson);
    if (parsed?.version !== 1) return null;
    if (isShareWebsiteReportData(parsed)) {
      return { kind: "website", data: parsed };
    }
    if (Array.isArray(parsed.campaigns)) {
      return { kind: "ads", data: parsed as ShareReportData };
    }
    return null;
  } catch {
    return null;
  }
});

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const payload = await getReportByToken(token);
  if (!payload) {
    return { title: "Report not found — NextReport" };
  }

  const title =
    payload.kind === "website"
      ? `${payload.data.accountName} — ${websiteReportTypeLabel()} | NextReport`
      : `${payload.data.accountName} — ${reportTypeLabel(payload.data)} | NextReport`;
  const description =
    payload.kind === "website"
      ? `${payload.data.accountName} website traffic — ${payload.data.dateRangeLabel}`
      : `${payload.data.accountName} performance report — ${payload.data.cover.dateRange}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: "/logo.png" }],
    },
    twitter: {
      card: "summary",
      title,
      description,
      images: ["/logo.png"],
    },
    robots: { index: false, follow: false },
  };
}

export default async function SharedReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const payload = await getReportByToken(token);
  if (!payload) notFound();

  if (payload.kind === "website") {
    return <ShareWebsiteReportView data={payload.data} shareToken={token} />;
  }

  return <ShareReportView data={payload.data} shareToken={token} />;
}
