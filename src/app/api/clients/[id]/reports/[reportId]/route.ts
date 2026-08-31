import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteReportFile, saveReportFile, readLogoFile } from "@/lib/storage";
import { apiErrorResponse } from "@/lib/api-error";
import type { ShareReportData, ShareVisibility } from "@/lib/nre/share-report";
import { defaultShareVisibility } from "@/lib/nre/share-report";
import { regeneratePptxFromShare, type ShareReportWithArchive } from "@/lib/nre/regenerate-report";
import { generateReportPdf } from "@/lib/pdf/generate-report-pdf";
import { canDownloadReportPdf } from "@/lib/pdf/ensure-report-pdf";
import { loadTemplateBufferForPlatform } from "@/lib/pptx/templates";
import { detectLogoFormat, readLogoDimensions, extensionForLogoFormat, contentTypeForLogoFormat } from "@/lib/logo-processing";
import type { ImageAsset } from "@/lib/pptx/embed-image";

/** Publish regenerates PPTX and captures PDF via headless Chromium — allow extra time on serverless. */
export const maxDuration = 120;

async function loadLogoAsset(url: string | null | undefined): Promise<ImageAsset | null> {
  if (!url) return null;
  const bytes = await readLogoFile(url);
  const format = detectLogoFormat(bytes);
  if (!format) return null;
  const dimensions = readLogoDimensions(bytes, format);
  if (!dimensions) return null;
  return {
    bytes,
    widthPx: dimensions.width,
    heightPx: dimensions.height,
    extension: extensionForLogoFormat(format),
    contentType: contentTypeForLogoFormat(format),
  };
}

const MAX_DISPLAY_NAME_LENGTH = 200;
const MAX_COPY_CHARS = 800;

const copySlideSchema = z.object({
  campaignName: z.string(),
  adSetName: z.string().optional(),
  aiSummary: z.string().max(MAX_COPY_CHARS),
  aiInsights: z.string().max(MAX_COPY_CHARS),
  metrics: z
    .array(z.object({ key: z.string(), value: z.string().max(64) }))
    .optional(),
});

const visibilitySchema = z.object({
  cover: z.boolean(),
  overview: z.boolean(),
  combinedTotal: z.boolean(),
  metricGuide: z.boolean(),
  campaigns: z.record(z.string(), z.boolean()),
  adSets: z.record(z.string(), z.boolean()),
});

const chartEditSchema = z.object({
  title: z.string().max(200),
  subtitle: z.string().max(200),
  totalSpendLabel: z.string().max(64),
  footerInsight: z.string().max(200).optional(),
  snapshot: z.object({
    mtdSpendLabel: z.string().max(64),
    primaryResultsValue: z.string().max(64),
    primaryResultsLabel: z.string().max(64),
    primaryCprValue: z.string().max(64),
    primaryCprLabel: z.string().max(64),
    budgetPctUsed: z.string().max(32),
    activeCampaignCount: z.number().int().min(0),
  }),
  donutSegments: z.array(
    z.object({
      name: z.string().max(200),
      spendLabel: z.string().max(64),
      percentage: z.number(),
      color: z.string().max(6),
    }),
  ),
});

const shareReviewSchema = z.object({
  publish: z.boolean().optional(),
  visibility: visibilitySchema,
  campaigns: z.array(copySlideSchema),
  adSets: z.array(copySlideSchema).optional(),
  chart: chartEditSchema.optional(),
});

function parseShareJson(raw: string | null): ShareReportWithArchive | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.version !== 1 || !Array.isArray(parsed.campaigns)) return null;
    return parsed as ShareReportWithArchive;
  } catch {
    return null;
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; reportId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id, reportId } = await params;
    const report = await prisma.report.findUnique({ where: { id: reportId }, include: { client: true } });
    if (!report || report.client.userId !== session.user.id || report.clientId !== id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const share = parseShareJson(report.summaryJson);
    if (!share) {
      return NextResponse.json({ ok: true, share: null, campaigns: [], adSets: [], visibility: null, shareToken: report.shareToken, reportStatus: report.status, canSyncPpt: false });
    }
    const visibility = share.visibility ?? defaultShareVisibility(share);
    return NextResponse.json({
      ok: true,
      share,
      visibility,
      publishedAt: share.publishedAt ?? null,
      shareToken: report.shareToken,
      reportStatus: report.status,
      canSyncPpt: !!(share as ShareReportWithArchive)._renderArchive,
      pdfAvailable: canDownloadReportPdf(share),
      campaigns: share.campaigns.map((c) => ({
        campaignName: c.campaignName,
        aiSummary: c.aiSummary,
        aiInsights: c.aiInsights,
        metrics: c.metrics.map((m) => ({ key: m.key, label: m.label, value: m.value })),
      })),
      adSets: share.adSets.map((c) => ({
        campaignName: c.campaignName,
        adSetName: c.adSetName,
        aiSummary: c.aiSummary,
        aiInsights: c.aiInsights,
        metrics: c.metrics.map((m) => ({ key: m.key, label: m.label, value: m.value })),
      })),
      chart: share.chart ?? null,
    });
  } catch (err) {
    return apiErrorResponse(err, "reports:copy-get");
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; reportId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id, reportId } = await params;
    const report = await prisma.report.findUnique({ where: { id: reportId }, include: { client: true } });
    if (!report || report.client.userId !== session.user.id || report.clientId !== id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid body." }, { status: 400 });
    }

    if (typeof body.displayName === "string") {
      const trimmed = body.displayName.trim().slice(0, MAX_DISPLAY_NAME_LENGTH);
      const updated = await prisma.report.update({
        where: { id: reportId },
        data: { displayName: trimmed || null },
      });
      return NextResponse.json({ ok: true, displayName: updated.displayName });
    }

    if (body.shareReview) {
      const parsed = shareReviewSchema.safeParse(body.shareReview);
      if (!parsed.success) {
        return NextResponse.json({ error: "shareReview is invalid." }, { status: 400 });
      }
      const share = parseShareJson(report.summaryJson);
      if (!share) {
        return NextResponse.json({ error: "This report has no live-link data to edit." }, { status: 400 });
      }

      const campaignCopy = new Map(parsed.data.campaigns.map((c) => [c.campaignName, c]));
      share.campaigns = share.campaigns.map((c) => {
        const next = campaignCopy.get(c.campaignName);
        if (!next) return c;
        let metrics = c.metrics;
        if (next.metrics?.length) {
          const byKey = new Map(next.metrics.map((m) => [m.key, m.value]));
          metrics = c.metrics.map((m) => (byKey.has(m.key) ? { ...m, value: byKey.get(m.key)! } : m));
        }
        return { ...c, aiSummary: next.aiSummary, aiInsights: next.aiInsights, metrics };
      });
      if (parsed.data.adSets) {
        share.adSets = share.adSets.map((c) => {
          const next = parsed.data.adSets!.find((a) => a.campaignName === c.campaignName && a.adSetName === c.adSetName);
          if (!next) return c;
          let metrics = c.metrics;
          if (next.metrics?.length) {
            const byKey = new Map(next.metrics.map((m) => [m.key, m.value]));
            metrics = c.metrics.map((m) => (byKey.has(m.key) ? { ...m, value: byKey.get(m.key)! } : m));
          }
          return { ...c, aiSummary: next.aiSummary, aiInsights: next.aiInsights, metrics };
        });
      }
      share.visibility = parsed.data.visibility as ShareVisibility;
      if (parsed.data.chart && share.chart) {
        share.chart = { ...share.chart, ...parsed.data.chart };
      }
      if (parsed.data.publish) {
        share.publishedAt = new Date().toISOString();
      }

      let filePath = report.filePath;
      let pdfPath = report.pdfPath;
      if (parsed.data.publish && share._renderArchive) {
        const templateBuffer = await loadTemplateBufferForPlatform(report.platform, report.client.template);
        const clientLogo = await loadLogoAsset(report.client.logoUrl);
        const pptxBuffer = await regeneratePptxFromShare(share, templateBuffer, clientLogo);
        if (filePath) await deleteReportFile(filePath).catch(() => undefined);
        filePath = await saveReportFile(reportId, pptxBuffer);
      }

      if (parsed.data.publish && report.shareToken) {
        const nextPdfPath = await generateReportPdf({
          reportId,
          shareToken: report.shareToken,
          share,
          previousPdfPath: pdfPath,
        });
        if (nextPdfPath) pdfPath = nextPdfPath;
      }

      await prisma.report.update({
        where: { id: reportId },
        data: {
          summaryJson: JSON.stringify(share),
          ...(filePath ? { filePath } : {}),
          ...(pdfPath !== report.pdfPath ? { pdfPath } : {}),
        },
      });
      return NextResponse.json({
        ok: true,
        publishedAt: share.publishedAt ?? null,
        pdfAvailable: canDownloadReportPdf(share),
      });
    }

    // Legacy copy-only PATCH
    if (body.copyReview) {
      const legacySchema = z.object({
        campaigns: z.array(copySlideSchema),
        adSets: z.array(copySlideSchema).optional(),
      });
      const parsed = legacySchema.safeParse(body.copyReview);
      if (!parsed.success) {
        return NextResponse.json({ error: "copyReview is invalid." }, { status: 400 });
      }
      const share = parseShareJson(report.summaryJson);
      if (!share) {
        return NextResponse.json({ error: "This report has no live-link copy to edit." }, { status: 400 });
      }
      const campaignCopy = new Map(parsed.data.campaigns.map((c) => [c.campaignName, c]));
      share.campaigns = share.campaigns.map((c) => {
        const next = campaignCopy.get(c.campaignName);
        return next ? { ...c, aiSummary: next.aiSummary, aiInsights: next.aiInsights } : c;
      });
      if (parsed.data.adSets) {
        share.adSets = share.adSets.map((c) => {
          const next = parsed.data.adSets!.find((a) => a.campaignName === c.campaignName && a.adSetName === c.adSetName);
          return next ? { ...c, aiSummary: next.aiSummary, aiInsights: next.aiInsights } : c;
        });
      }
      await prisma.report.update({
        where: { id: reportId },
        data: { summaryJson: JSON.stringify(share) },
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Provide displayName or shareReview." }, { status: 400 });
  } catch (err) {
    return apiErrorResponse(err, "reports:share-review");
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; reportId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id, reportId } = await params;
    const report = await prisma.report.findUnique({ where: { id: reportId }, include: { client: true } });
    if (!report || report.client.userId !== session.user.id || report.clientId !== id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (report.filePath) await deleteReportFile(report.filePath);
    if (report.pdfPath) await deleteReportFile(report.pdfPath);

    await prisma.report.delete({ where: { id: reportId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err, "reports:delete");
  }
}
