import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fileFromFormData } from "@/lib/http-file";
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
import { parseWebsiteReportConfig } from "@/lib/nre/website-report-data";
import { formatDateUS } from "@/lib/nre/dates";
import { resolveWebsiteReportData, type WebsiteDataSource } from "@/lib/nre/website-report-resolve";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const contentType = req.headers.get("content-type") ?? "";
  let config = parseWebsiteReportConfig(null);
  let csvBuffer: Buffer | null = null;
  let dataSource: WebsiteDataSource = "api";

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    csvBuffer = await fileFromFormData(formData, "ga4Csv");
    const configRaw = formData.get("config");
    if (typeof configRaw === "string") {
      try {
        config = parseWebsiteReportConfig(JSON.parse(configRaw));
      } catch {
        /* defaults */
      }
    }
    const ds = formData.get("dataSource");
    if (ds === "csv" || csvBuffer) dataSource = "csv";
  } else {
    try {
      const body = await req.json().catch(() => null);
      config = parseWebsiteReportConfig(body);
      if (body && typeof body === "object" && (body as Record<string, unknown>).dataSource === "csv") {
        dataSource = "csv";
      }
    } catch {
      /* defaults */
    }
  }

  if (dataSource === "api" && !client.ga4PropertyId) {
    return NextResponse.json({ error: "Link a GA4 property to this client first." }, { status: 400 });
  }

  if (dataSource === "csv" && !csvBuffer) {
    return NextResponse.json({ error: "Upload a GA4 CSV export (field: ga4Csv)." }, { status: 400 });
  }

  const weekStart = formatDateUS(new Date().toISOString().slice(0, 10)).replace(/\//g, "-");
  const weekEnd = weekStart;
  const fileName = `Website Traffic Report - ${client.accountName}.pptx`.replace(/[\s/]/g, "_");
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
    const { data: websiteData } = await resolveWebsiteReportData({
      userId: session.user.id,
      timezone: client.timezone,
      currencySymbol: CURRENCY_SYMBOLS[client.currency] ?? "$",
      accountName: client.accountName,
      ga4PropertyId: client.ga4PropertyId,
      ga4PropertyName: client.ga4PropertyName,
      config,
      dataSource,
      csvBuffer,
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
