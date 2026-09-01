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

const coverEditSchema = z.object({
  accountName: z.string().max(200),
  dateRange: z.string().max(200),
  healthBadge: z.string().max(200),
});

const visualSlideEditSchema = z.object({
  title: z.string().max(200).optional(),
  summaryLine: z.string().max(500).optional(),
  groupedDonutCenterLabel: z.string().max(64).optional(),
});

const chartEditSchema = z.object({
  title: z.string().max(200),
  subtitle: z.string().max(200),
  totalSpendLabel: z.string().max(64),
  footerInsight: z.string().max(500).optional(),
  visualSlide: visualSlideEditSchema.optional(),
  snapshot: z.object({
    mode: z.enum(["single", "multi"]).optional(),
    mtdSpendLabel: z.string().max(64),
    primaryResultsValue: z.string().max(64),
    primaryResultsLabel: z.string().max(64),
    primaryCprValue: z.string().max(64),
    primaryCprLabel: z.string().max(64),
    primarySpendFormatted: z.string().max(64).optional(),
    activeCampaignCount: z.number().int().min(0),
    objectivesOmittedCount: z.number().int().min(0).optional(),
    objectives: z
      .array(
        z.object({
          label: z.string().max(64),
          resultsValue: z.string().max(64),
          cprValue: z.string().max(64),
          cprLabel: z.string().max(64),
          spendFormatted: z.string().max(64),
        }),
      )
      .optional(),
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

const tableRowEditSchema = z.object({
  monthLabel: z.string().max(64),
  spend: z.string().max(64),
  reach: z.string().max(64),
  impressions: z.string().max(64),
  ctr: z.string().max(64),
  cpc: z.string().max(64),
  resultColumns: z.array(
    z.object({
      label: z.string().max(64),
      costLabel: z.string().max(64),
      value: z.string().max(64),
      cprValue: z.string().max(64),
    }),
  ),
});

const combinedTotalEditSchema = z.object({
  periodRow: tableRowEditSchema,
  mtdRow: tableRowEditSchema,
});

const shareReviewSchema = z.object({
  publish: z.boolean().optional(),
  visibility: visibilitySchema,
  cover: coverEditSchema.optional(),
  combinedTotal: combinedTotalEditSchema.optional(),
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
      if (parsed.data.cover) {
        share.accountName = parsed.data.cover.accountName;
        share.cover = {
          ...share.cover,
          dateRange: parsed.data.cover.dateRange,
          healthBadge: parsed.data.cover.healthBadge,
          budgetSummary: "",
        };
      }
      if (parsed.data.chart && share.chart) {
        const { visualSlide: visualSlidePatch, ...chartPatch } = parsed.data.chart;
        const mergedVisualSlide =
          visualSlidePatch && share.chart.visualSlide
            ? { ...share.chart.visualSlide, ...visualSlidePatch }
            : share.chart.visualSlide;
        share.chart = {
          ...share.chart,
          ...chartPatch,
          ...(mergedVisualSlide ? { visualSlide: mergedVisualSlide } : {}),
        };
      }
      if (parsed.data.combinedTotal) {
        share.periodRow = { ...share.periodRow, ...parsed.data.combinedTotal.periodRow };
        share.mtdRow = { ...share.mtdRow, ...parsed.data.combinedTotal.mtdRow };
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

      await prisma.report.update({
        where: { id: reportId },
        data: {
          summaryJson: JSON.stringify(share),
          ...(filePath ? { filePath } : {}),
        },
      });

      if (parsed.data.publish && report.shareToken) {
        const nextPdfPath = await generateReportPdf({
          reportId,
          shareToken: report.shareToken,
          share,
          previousPdfPath: pdfPath,
        });
        if (nextPdfPath) {
          pdfPath = nextPdfPath;
          await prisma.report.update({
            where: { id: reportId },
            data: { pdfPath },
          });
        }
      }
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
