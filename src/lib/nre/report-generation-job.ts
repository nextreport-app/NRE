/**
 * Async report generation worker — AI, render, persist run outside the
 * wizard POST so the client can poll status instead of blocking.
 *
 * GA4 website reports are intentionally excluded — they use a forked pipeline
 * (WebsiteReportData + renderWebsitePptx). See docs/ga4-reporting-architecture.md.
 */

import { prisma } from "@/lib/prisma";
import type { Platform } from "@/lib/nre/google-columns";
import { deleteWizardUploadSession } from "@/lib/nre/wizard-upload-session";
import type { ComparisonReportData, ReportData } from "@/lib/nre/report-data";
import type { HistoricalReportData } from "@/lib/nre/historical-report-data";
import { buildShareReportData, buildHistoricalShareReportData } from "@/lib/nre/share-report";
import { generateShareToken } from "@/lib/share-token";
import { CURRENCY_SYMBOLS } from "@/lib/nre/format";
import { aiKeysFromEnv } from "@/lib/ai/client";
import { generateInsights } from "@/lib/ai/generate-insights";
import { renderComparisonPptx, renderHistoricalPptx, renderPptx } from "@/lib/pptx/render";
import { buildHistoricalAiCopyMap } from "@/lib/nre/historical-report-data";
import type { ImageAsset } from "@/lib/pptx/embed-image";
import { isLightReportTemplate, loadTemplateBufferForPlatform } from "@/lib/pptx/templates";
import { saveReportFile, readLogoFile } from "@/lib/storage";
import { contentTypeForLogoFormat, detectLogoFormat, extensionForLogoFormat, readLogoDimensions } from "@/lib/logo-processing";
import { notifyReportGeneratedForUser } from "@/lib/report-notifications";
import type { Client } from "@/generated/prisma/client";

export const REPORT_GENERATION_JOB_VERSION = 1 as const;

export type ReportGenerationJobPayload =
  | StandardReportJobPayload
  | ComparisonReportJobPayload
  | HistoricalReportJobPayload
  | PreviousMonthSummaryJobPayload;

interface BaseJobPayload {
  version: typeof REPORT_GENERATION_JOB_VERSION;
  userId: string;
  clientId: string;
  uploadSessionId?: string;
}

export interface StandardReportJobPayload extends BaseJobPayload {
  kind: "STANDARD";
  platform: Platform;
  reportTitle?: string;
  reportData: ReportData;
}

export interface ComparisonReportJobPayload extends BaseJobPayload {
  kind: "COMPARISON";
  platform: Platform;
  reportTitle?: string;
  comparisonData: ComparisonReportData;
}

export interface HistoricalReportJobPayload extends BaseJobPayload {
  kind: "HISTORICAL";
  platform: Platform;
  reportTitle?: string;
  historicalData: HistoricalReportData;
  shareToken: string;
}

export interface PreviousMonthSummaryJobPayload extends BaseJobPayload {
  kind: "PREVIOUS_MONTH_SUMMARY";
  platform: Platform;
  summaryData: ReportData;
  shareToken: string;
}

export function serializeReportGenerationJob(payload: ReportGenerationJobPayload): string {
  return JSON.stringify({ ...payload, version: REPORT_GENERATION_JOB_VERSION });
}

export function parseReportGenerationJob(raw: string | null | undefined): ReportGenerationJobPayload | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as ReportGenerationJobPayload;
    if (parsed.version !== REPORT_GENERATION_JOB_VERSION) return null;
    if (!parsed.userId || !parsed.clientId || !parsed.kind) return null;
    return parsed;
  } catch {
    return null;
  }
}

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

function dispatchReportNotifications(params: {
  userId: string;
  integrations: { slackWebhookUrl: string | null; automationWebhookUrl: string | null } | null;
  client: Client;
  report: {
    id: string;
    shareToken: string | null;
    reportType: string;
    platform: "META" | "GOOGLE" | "TIKTOK";
    displayName: string | null;
  };
  healthScore?: number | null;
  healthBadge?: string | null;
}) {
  void notifyReportGeneratedForUser({
    userId: params.userId,
    integrationSelect: params.integrations,
    reportId: params.report.id,
    shareToken: params.report.shareToken,
    clientName: params.client.accountName,
    platform: params.report.platform,
    reportType: params.report.reportType,
    displayName: params.report.displayName,
    healthScore: params.healthScore,
    healthBadge: params.healthBadge,
  }).catch((err) => {
    console.error("[report-generation-job] notification failed:", err);
  });
}

async function cleanupUploadSession(userId: string, clientId: string, sessionId: string | undefined) {
  if (sessionId) {
    await deleteWizardUploadSession(userId, clientId, sessionId).catch(() => {});
  }
}

async function markReportFailed(reportId: string, message: string) {
  await prisma.report.update({
    where: { id: reportId },
    data: { status: "FAILED", errorMessage: message, jobPayload: null },
  });
}

export async function processReportGeneration(reportId: string): Promise<void> {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: { client: true },
  });
  if (!report || report.status !== "GENERATING") return;

  const job = parseReportGenerationJob(report.jobPayload);
  if (!job) {
    await markReportFailed(reportId, "Report job payload is missing or invalid.");
    return;
  }

  const client = report.client;
  const userIntegrations = await prisma.user.findUnique({
    where: { id: job.userId },
    select: { slackWebhookUrl: true, automationWebhookUrl: true },
  });

  try {
    if (job.kind === "PREVIOUS_MONTH_SUMMARY") {
      const currencySymbol = CURRENCY_SYMBOLS[client.currency];
      const [user, clientLogo] = await Promise.all([
        prisma.user.findUnique({ where: { id: job.userId }, select: { agencyName: true } }),
        loadLogoAsset(client.logoUrl),
      ]);

      const templateBuffer = await loadTemplateBufferForPlatform(job.platform, client.template);
      const pptxBuffer = await renderPptx({
        templateBuffer,
        data: job.summaryData,
        currencySymbol,
        reportTitle: "PREVIOUS MONTH PERFORMANCE SUMMARY",
        agencyName: user?.agencyName,
        clientLogo,
        isLightTemplate: isLightReportTemplate(client.template),
      });

      const filePath = await saveReportFile(reportId, pptxBuffer);
      const shareData = buildShareReportData(job.summaryData, new Map(), new Date(), {
        currencySymbol,
        agencyName: user?.agencyName,
      });

      await prisma.report.update({
        where: { id: reportId },
        data: { status: "COMPLETE", filePath, summaryJson: JSON.stringify(shareData), jobPayload: null },
      });

      dispatchReportNotifications({
        userId: job.userId,
        integrations: userIntegrations,
        client,
        report: {
          id: reportId,
          shareToken: job.shareToken,
          reportType: "MONTHLY",
          platform: job.platform,
          displayName: report.displayName,
        },
        healthScore: shareData.cover?.healthScore,
        healthBadge: shareData.cover?.healthBadge,
      });
      await cleanupUploadSession(job.userId, job.clientId, job.uploadSessionId);
      return;
    }

    if (job.kind === "COMPARISON") {
      const user = await prisma.user.findUnique({ where: { id: job.userId }, select: { agencyName: true } });
      const templateBuffer = await loadTemplateBufferForPlatform(job.platform, client.template);
      const pptxBuffer = await renderComparisonPptx({
        templateBuffer,
        data: job.comparisonData,
        reportTitle: job.reportTitle,
        agencyName: user?.agencyName,
        isLightTemplate: isLightReportTemplate(client.template),
      });

      const filePath = await saveReportFile(reportId, pptxBuffer);
      const shareToken = generateShareToken();

      await prisma.report.update({
        where: { id: reportId },
        data: { status: "COMPLETE", filePath, shareToken, jobPayload: null },
      });

      dispatchReportNotifications({
        userId: job.userId,
        integrations: userIntegrations,
        client,
        report: {
          id: reportId,
          shareToken,
          reportType: "COMPARISON",
          platform: job.platform,
          displayName: report.displayName,
        },
      });
      await cleanupUploadSession(job.userId, job.clientId, job.uploadSessionId);
      return;
    }

    if (job.kind === "HISTORICAL") {
      const [user, clientLogo] = await Promise.all([
        prisma.user.findUnique({ where: { id: job.userId }, select: { agencyName: true } }),
        loadLogoAsset(client.logoUrl),
      ]);

      const templateBuffer = await loadTemplateBufferForPlatform(
        job.platform === "TIKTOK" ? "TIKTOK" : "META",
        client.template,
      );
      const aiCopyMap = buildHistoricalAiCopyMap(job.historicalData.slides);
      const pptxBuffer = await renderHistoricalPptx({
        templateBuffer,
        data: job.historicalData,
        reportTitle: job.reportTitle,
        agencyName: user?.agencyName,
        clientLogo,
        isLightTemplate: isLightReportTemplate(client.template),
        aiCopyBySlideKey: aiCopyMap,
      });

      const filePath = await saveReportFile(reportId, pptxBuffer);
      const shareData = buildHistoricalShareReportData(job.historicalData, aiCopyMap, new Date(), {
        agencyName: user?.agencyName,
      });
      const shareWithArchive = {
        ...shareData,
        _renderArchive: {
          historicalData: job.historicalData,
          aiCopy: Object.fromEntries(aiCopyMap),
          reportTitle: job.reportTitle,
          agencyName: user?.agencyName ?? null,
          isLightTemplate: isLightReportTemplate(client.template),
        },
      };

      await prisma.report.update({
        where: { id: reportId },
        data: { status: "COMPLETE", filePath, summaryJson: JSON.stringify(shareWithArchive), jobPayload: null },
      });

      dispatchReportNotifications({
        userId: job.userId,
        integrations: userIntegrations,
        client,
        report: {
          id: reportId,
          shareToken: job.shareToken,
          reportType: "HISTORICAL",
          platform: job.platform === "TIKTOK" ? "TIKTOK" : "META",
          displayName: report.displayName,
        },
      });
      await cleanupUploadSession(job.userId, job.clientId, job.uploadSessionId);
      return;
    }

    // STANDARD — Meta / Google / TikTok weekly/monthly/etc.
    const { reportData, platform, reportTitle } = job;
    const currencySymbol = CURRENCY_SYMBOLS[client.currency];

    const [aiCopyBySlideKey, user, clientLogo] = await Promise.all([
      generateInsights(reportData, aiKeysFromEnv()),
      prisma.user.findUnique({ where: { id: job.userId }, select: { agencyName: true } }),
      loadLogoAsset(client.logoUrl),
    ]);

    const templateBuffer = await loadTemplateBufferForPlatform(platform, client.template);
    const pptxBuffer = await renderPptx({
      templateBuffer,
      data: reportData,
      currencySymbol,
      aiCopyBySlideKey,
      reportTitle,
      agencyName: user?.agencyName,
      clientLogo,
      isLightTemplate: isLightReportTemplate(client.template),
    });

    const filePath = await saveReportFile(reportId, pptxBuffer);
    const shareData = buildShareReportData(reportData, aiCopyBySlideKey, new Date(), {
      currencySymbol,
      agencyName: user?.agencyName,
    });
    const shareWithArchive = {
      ...shareData,
      _renderArchive: {
        reportData,
        aiCopy: Object.fromEntries(aiCopyBySlideKey),
        currencySymbol,
        isLightTemplate: isLightReportTemplate(client.template),
        reportTitle,
        agencyName: user?.agencyName ?? null,
      },
    };

    await prisma.report.update({
      where: { id: reportId },
      data: { status: "COMPLETE", filePath, summaryJson: JSON.stringify(shareWithArchive), jobPayload: null },
    });

    dispatchReportNotifications({
      userId: job.userId,
      integrations: userIntegrations,
      client,
      report: {
        id: reportId,
        shareToken: report.shareToken,
        reportType: reportData.reportType,
        platform,
        displayName: report.displayName,
      },
      healthScore: reportData.cover.healthScore,
      healthBadge: reportData.cover.healthBadge,
    });
    await cleanupUploadSession(job.userId, job.clientId, job.uploadSessionId);
  } catch (err) {
    console.error("[report-generation-job] failed:", err);
    const message = err instanceof Error ? err.message : "Report generation failed.";
    await markReportFailed(reportId, message);
  }
}
