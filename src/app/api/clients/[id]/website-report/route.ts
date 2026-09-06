import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getGa4AccessTokenForUser } from "@/lib/ga4-session";
import { defaultWebsiteReportRanges, fetchGa4WebsiteReport } from "@/lib/nre/fetch-ga4-website-report";
import { buildShareWebsiteReportData } from "@/lib/nre/share-website-report";
import { CURRENCY_SYMBOLS } from "@/lib/nre/format";
import { generateShareToken } from "@/lib/share-token";
import { defaultReportDisplayName } from "@/lib/nre/report-display-name";
import { renderWebsitePptx } from "@/lib/pptx/render";
import { loadTemplateBuffer } from "@/lib/pptx/templates";
import { saveReportFile } from "@/lib/storage";
import { apiErrorResponse } from "@/lib/api-error";
import { requireActiveSubscription } from "@/lib/subscription-guard";
import { notifyReportGeneratedForUser } from "@/lib/report-notifications";

function isoToUsDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}/${y}`;
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const guard = await requireActiveSubscription(session.user.id);
  if (guard) return guard;

  const { id } = await params;

  let client;
  let user;
  try {
    [client, user] = await Promise.all([
      prisma.client.findUnique({ where: { id } }),
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { agencyName: true, slackWebhookUrl: true, automationWebhookUrl: true },
      }),
    ]);
  } catch (err) {
    return apiErrorResponse(err, "website-report:generate:lookup");
  }

  if (!client || client.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!client.ga4PropertyId) {
    return NextResponse.json({ error: "Link a GA4 property to this client first." }, { status: 400 });
  }

  const accessToken = await getGa4AccessTokenForUser(session.user.id);
  if (!accessToken) {
    return NextResponse.json({ error: "Connect Google Analytics in Account Settings first." }, { status: 400 });
  }

  const ranges = defaultWebsiteReportRanges(client.timezone);
  const weekStart = isoToUsDate(ranges.current.startIso);
  const weekEnd = isoToUsDate(ranges.current.endIso);
  const fileName = `Website Traffic Report - ${client.accountName} - ${weekStart} to ${weekEnd}.pptx`.replace(/[\s/]/g, "_");
  const displayName = defaultReportDisplayName("WEBSITE", weekStart, weekEnd);

  let report;
  try {
    report = await prisma.report.create({
      data: {
        clientId: client.id,
        status: "GENERATING",
        reportType: "WEBSITE",
        platform: "GA4",
        fileName,
        displayName,
        weekStart,
        weekEnd,
        shareToken: generateShareToken(),
      },
    });
  } catch (err) {
    return apiErrorResponse(err, "website-report:generate:create");
  }

  try {
    const websiteData = await fetchGa4WebsiteReport({
      accessToken,
      propertyId: client.ga4PropertyId,
      propertyName: client.ga4PropertyName ?? client.ga4PropertyId,
      currencySymbol: CURRENCY_SYMBOLS[client.currency] ?? "$",
      currentRange: ranges.current,
      comparisonRange: ranges.previous,
    });

    const templateBuffer = await loadTemplateBuffer(client.template);
    const pptxBuffer = await renderWebsitePptx({
      templateBuffer,
      data: websiteData,
      accountName: client.accountName,
      agencyName: user?.agencyName,
    });

    const storedPath = await saveReportFile(report.id, pptxBuffer);
    const shareJson = buildShareWebsiteReportData(websiteData, {
      agencyName: user?.agencyName,
      accountName: client.accountName,
    });

    await prisma.report.update({
      where: { id: report.id },
      data: {
        status: "COMPLETE",
        filePath: storedPath,
        summaryJson: JSON.stringify(shareJson),
      },
    });

    void notifyReportGeneratedForUser({
      userId: session.user.id,
      integrationSelect: user,
      reportId: report.id,
      shareToken: report.shareToken,
      clientName: client.accountName,
      platform: "GA4",
      reportType: "WEBSITE",
      displayName,
    }).catch((err) => {
      console.error("[api:website-report:generate] notification failed:", err);
    });

    return NextResponse.json({
      reportId: report.id,
      fileName,
      displayName,
      shareToken: report.shareToken,
      downloadUrl: `/api/reports/${report.id}/download`,
    });
  } catch (err) {
    console.error("[api:website-report:generate]", err);
    await prisma.report.update({
      where: { id: report.id },
      data: { status: "FAILED" },
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Report generation failed" },
      { status: 500 },
    );
  }
}
