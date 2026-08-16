import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteReportFile } from "@/lib/storage";
import { parseUploadedFile, parseUploadedFileHeadersAndRows } from "@/lib/nre/parse-file";
import { validateMtdDailyCsv } from "@/lib/nre/validate";
import { buildComparisonReportData, buildReportData, type ReportData } from "@/lib/nre/report-data";
import { buildShareReportData } from "@/lib/nre/share-report";
import { generateShareToken } from "@/lib/share-token";
import { defaultReportDisplayName } from "@/lib/nre/report-display-name";
import { buildGoogleReportData } from "@/lib/nre/google-report-data";
import { detectPlatform, readGoogleRowsWithAutoMap } from "@/lib/nre/google-columns";
import { validateGoogleAdsCsv } from "@/lib/nre/validate-google";
import { CURRENCY_SYMBOLS } from "@/lib/nre/format";
import { aiKeysFromEnv } from "@/lib/ai/client";
import { generateInsights } from "@/lib/ai/generate-insights";
import { renderComparisonPptx, renderPptx } from "@/lib/pptx/render";
import type { ImageAsset } from "@/lib/pptx/embed-image";
import { loadTemplateBufferForPlatform } from "@/lib/pptx/templates";
import { saveReportFile, readLogoFile } from "@/lib/storage";
import { apiErrorResponse } from "@/lib/api-error";
import { requireActiveSubscription } from "@/lib/subscription-guard";
import { fileFromFormData } from "@/lib/http-file";
import { resolveDateSelection } from "@/lib/nre/resolve-date-selection";
import { loadPreviousMonthDataRows } from "@/lib/nre/previous-month-data";
import { contentTypeForLogoFormat, detectLogoFormat, extensionForLogoFormat, readLogoDimensions } from "@/lib/logo-processing";
import { mergeObjectiveCache, parseObjectiveCache } from "@/lib/nre/objective-cache";
import {
  campaignObjectivesSchema,
  comparisonPeriodSchema,
  confirmedCampaignObjectivesSchema,
  dateSelectionSchema,
  parseJsonFormField,
  platformSchema,
  reportTitleSchema,
  reportTypeSchema,
  selectedAdSetsSchema,
  selectedCampaignsSchema,
  selectedMetricsSchema,
} from "@/lib/validators/report-wizard";
import type { Client } from "@/generated/prisma/client";

/** Downloads a stored logo and reads its pixel dimensions + format back from its own bytes — see logo-processing.ts for why this is a header-only read, never a decode. */
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

/** Meta path: full campaign/ad-set selection + weekly/monthly date-range resolution + Previous Month Data comparison. Returns an error message on invalid input, or the built ReportData. */
async function buildMetaData(
  client: Client,
  mtdDailyBuffer: Buffer,
  formData: FormData | null,
): Promise<{ error: string } | { data: ReportData }> {
  const mtdParsed = parseUploadedFile(mtdDailyBuffer, "MTD Daily CSV");
  const validation = validateMtdDailyCsv(mtdParsed.colMap, mtdParsed.rows, undefined, mtdParsed.headers);
  if (!validation.valid) {
    return { error: validation.errors.map((e) => e.message).join(" ") };
  }

  const selectedCampaigns = formData ? parseJsonFormField(formData, "selectedCampaigns", selectedCampaignsSchema) : undefined;
  const selectedAdSets = formData ? parseJsonFormField(formData, "selectedAdSets", selectedAdSetsSchema) : undefined;
  const selectedMetrics = formData ? parseJsonFormField(formData, "selectedMetrics", selectedMetricsSchema) : undefined;
  const campaignObjectives = formData ? parseJsonFormField(formData, "campaignObjectives", campaignObjectivesSchema) : undefined;
  const dateSelection = formData ? parseJsonFormField(formData, "dateSelection", dateSelectionSchema) : undefined;
  // buildMetaData is only ever called for the WEEKLY/MONTHLY path — the
  // caller (POST below) returns early for reportType "COMPARISON" before
  // ever reaching here — but reportTypeSchema itself now allows all three
  // values, so this narrows defensively rather than widening report-data.ts's
  // own ReportType to match.
  const parsedReportType = formData ? parseJsonFormField(formData, "reportType", reportTypeSchema) : undefined;
  const reportType = parsedReportType === "MONTHLY" ? "MONTHLY" : "WEEKLY";

  const dateResolution = resolveDateSelection(mtdParsed.rows, dateSelection);
  if (!dateResolution.ok) {
    return { error: dateResolution.error || "Invalid date selection." };
  }

  const periodRows = await loadPreviousMonthDataRows(client);

  const data = buildReportData({
    accountName: client.accountName,
    currencySymbol: CURRENCY_SYMBOLS[client.currency],
    timezone: client.timezone,
    monthlyBudget: client.monthlyBudget,
    mtdDailyRows: mtdParsed.rows,
    periodRows,
    selectedCampaigns: selectedCampaigns ?? null,
    selectedAdSets: selectedAdSets ?? null,
    weeklyRange: dateResolution.weeklyRange,
    reportType,
    selectedMetrics,
    campaignObjectives,
    objectiveCache: parseObjectiveCache(client.campaignObjectiveCache),
  });

  return { data };
}

/** Google Ads path — deliberately simpler than Meta's: no campaign selection, no weekly/monthly toggle, no Previous Month Data — always the full MTD dataset (see google-report-data.ts's own file header for why). */
function buildGoogleData(
  client: Client,
  headers: string[],
  dataRows: string[][],
  selectedMetrics: z.infer<typeof selectedMetricsSchema> | undefined,
): { error: string } | { data: ReportData } {
  const { colMap, rows } = readGoogleRowsWithAutoMap(headers, dataRows);
  const validation = validateGoogleAdsCsv(colMap, rows, undefined, headers);
  if (!validation.valid) {
    return { error: validation.errors.map((e) => e.message).join(" ") };
  }

  const data = buildGoogleReportData({
    accountName: client.accountName,
    currencySymbol: CURRENCY_SYMBOLS[client.currency],
    monthlyBudget: client.monthlyBudget,
    mtdDailyRows: rows,
    selectedMetrics,
  });

  return { data };
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  let client;
  try {
    client = await prisma.client.findUnique({ where: { id } });
  } catch (err) {
    return apiErrorResponse(err, "reports:generate:lookup");
  }
  if (!client || client.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const guardResponse = await requireActiveSubscription(session.user.id);
  if (guardResponse) return guardResponse;

  const formData = await req.formData().catch(() => null);
  const mtdDailyBuffer = formData ? await fileFromFormData(formData, "mtdDailyCsv") : null;

  if (!mtdDailyBuffer || mtdDailyBuffer.length === 0) {
    return NextResponse.json({ error: "MTD Daily CSV is required." }, { status: 400 });
  }

  const { headers, dataRows } = parseUploadedFileHeadersAndRows(mtdDailyBuffer, "MTD Daily CSV");
  const platformOverride = formData ? parseJsonFormField(formData, "platform", platformSchema) : undefined;
  const platform = platformOverride ?? detectPlatform(headers);
  const reportTitle = formData ? parseJsonFormField(formData, "reportTitle", reportTitleSchema) : undefined;
  const reportType = formData ? parseJsonFormField(formData, "reportType", reportTypeSchema) : undefined;

  // Part 3 — Objective Confirmation memory cache. Every campaign the wizard's
  // Objective Confirmation step showed (cached pre-fills, untouched engine
  // detections, and user edits alike — see confirmedCampaignObjectivesPayload
  // in report-upload-wizard.tsx) gets merged into this client's persisted
  // cache. Fired here, before report generation even starts, and
  // deliberately NOT awaited — "This update happens in the background — do
  // not block report generation waiting for it." A failure here is logged
  // but never surfaces as a report-generation error: the cache is a UX
  // nicety for next month's wizard, not something this report depends on.
  const confirmedCampaignObjectives = formData
    ? parseJsonFormField(formData, "confirmedCampaignObjectives", confirmedCampaignObjectivesSchema)
    : undefined;
  if (confirmedCampaignObjectives && Object.keys(confirmedCampaignObjectives).length > 0) {
    prisma.client
      .update({
        where: { id: client.id },
        data: { campaignObjectiveCache: mergeObjectiveCache(client.campaignObjectiveCache, confirmedCampaignObjectives) },
      })
      .catch((err) => {
        console.error("[api:reports:generate] failed to update campaign objective cache:", err);
      });
  }

  // Comparison reports are an entirely separate pipeline (buildComparisonReportData
  // + renderComparisonPptx — see report-data.ts's own "Comparison reports"
  // section header) — handled fully here, never reaching buildMetaData/
  // buildGoogleData/renderPptx below, which stay exactly as they were.
  if (reportType === "COMPARISON") {
    const mtdParsed = parseUploadedFile(mtdDailyBuffer, "MTD Daily CSV");
    const validation = validateMtdDailyCsv(mtdParsed.colMap, mtdParsed.rows, undefined, mtdParsed.headers);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.errors.map((e) => e.message).join(" ") }, { status: 400 });
    }

    const selectedCampaigns = formData ? parseJsonFormField(formData, "selectedCampaigns", selectedCampaignsSchema) : undefined;
    const periodA = formData ? parseJsonFormField(formData, "comparisonPeriodA", comparisonPeriodSchema) : undefined;
    const periodB = formData ? parseJsonFormField(formData, "comparisonPeriodB", comparisonPeriodSchema) : undefined;
    if (!periodA || !periodB) {
      return NextResponse.json({ error: "Both comparison periods are required." }, { status: 400 });
    }

    const comparisonData = buildComparisonReportData({
      accountName: client.accountName,
      currencySymbol: CURRENCY_SYMBOLS[client.currency],
      timezone: client.timezone,
      mtdDailyRows: mtdParsed.rows,
      selectedCampaigns: selectedCampaigns ?? null,
      periodA: { startIso: periodA.startIso, endIso: periodA.endIso },
      periodB: { startIso: periodB.startIso, endIso: periodB.endIso },
    });

    const fileName = `Comparison Report - ${comparisonData.periodALabel} vs ${comparisonData.periodBLabel}.pptx`.replace(/[\s/]/g, "_");

    let comparisonReport;
    try {
      comparisonReport = await prisma.report.create({
        data: {
          clientId: client.id,
          status: "GENERATING",
          reportType: "COMPARISON",
          platform: "META",
          fileName,
          displayName: defaultReportDisplayName(
            "COMPARISON",
            null,
            null,
            `${comparisonData.periodALabel} vs ${comparisonData.periodBLabel}`,
          ),
          summaryJson: JSON.stringify({
            isPaused: comparisonData.isPaused,
            periodALabel: comparisonData.periodALabel,
            periodBLabel: comparisonData.periodBLabel,
            campaignCount: comparisonData.campaigns.length,
          }),
        },
      });
    } catch (err) {
      return apiErrorResponse(err, "reports:generate:create-comparison");
    }

    try {
      // Comparison covers reuse buildCoverSlideXml (see comparison-slides.ts's
      // buildComparisonCoverSlideXml) but don't currently place the client
      // logo — out of scope for this feature, so no loadLogoAsset call here.
      const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { agencyName: true } });

      const templateBuffer = await loadTemplateBufferForPlatform("META", client.template);
      const pptxBuffer = await renderComparisonPptx({
        templateBuffer,
        data: comparisonData,
        reportTitle,
        agencyName: user?.agencyName,
      });

      const filePath = await saveReportFile(comparisonReport.id, pptxBuffer);

      await prisma.report.update({
        where: { id: comparisonReport.id },
        data: { status: "COMPLETE", filePath },
      });

      return NextResponse.json({ ok: true, reportId: comparisonReport.id });
    } catch (err) {
      console.error("[api:reports:generate] comparison report failed:", err);
      const message = err instanceof Error ? err.message : "Report generation failed.";
      try {
        await prisma.report.update({
          where: { id: comparisonReport.id },
          data: { status: "FAILED", errorMessage: message },
        });
      } catch (updateErr) {
        console.error("[api:reports:generate] failed to record comparison failure status:", updateErr);
      }
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  const selectedMetrics = formData ? parseJsonFormField(formData, "selectedMetrics", selectedMetricsSchema) : undefined;
  const result =
    platform === "GOOGLE"
      ? buildGoogleData(client, headers, dataRows, selectedMetrics)
      : await buildMetaData(client, mtdDailyBuffer, formData);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  const { data } = result;
  const currencySymbol = CURRENCY_SYMBOLS[client.currency];

  const [weekStart, weekEnd] = data.fileDateRange.includes(" to ")
    ? data.fileDateRange.split(" to ")
    : [undefined, undefined];
  const filePrefix = platform === "GOOGLE" ? "Google Ads Report - " : "Meta Ads Report - ";
  const fileName = filePrefix + data.fileDateRange.replace(/[\s/]/g, "_") + ".pptx";

  let report;
  try {
    report = await prisma.report.create({
      data: {
        clientId: client.id,
        status: "GENERATING",
        reportType: data.reportType,
        platform,
        weekStart,
        weekEnd,
        fileName,
        displayName: defaultReportDisplayName(data.reportType, weekStart, weekEnd),
        // Generated unconditionally, before the report even finishes
        // rendering — the public share page checks status === "COMPLETE"
        // before trusting summaryJson, so a token existing on a still-
        // generating (or later FAILED) report is harmless.
        shareToken: generateShareToken(),
        summaryJson: JSON.stringify({
          isPaused: data.isPaused,
          healthScore: data.cover.healthScore,
          healthBadge: data.cover.healthBadge,
          campaignCount: data.campaignSlides.length,
          adSetCount: data.adSetSlides.length,
        }),
      },
    });
  } catch (err) {
    return apiErrorResponse(err, "reports:generate:create");
  }

  try {
    const [aiCopyBySlideKey, user, clientLogo] = await Promise.all([
      generateInsights(data, aiKeysFromEnv()),
      prisma.user.findUnique({ where: { id: session.user.id }, select: { agencyName: true } }),
      loadLogoAsset(client.logoUrl),
    ]);

    const templateBuffer = await loadTemplateBufferForPlatform(platform, client.template);
    const pptxBuffer = await renderPptx({
      templateBuffer,
      data,
      currencySymbol,
      aiCopyBySlideKey,
      reportTitle,
      agencyName: user?.agencyName,
      clientLogo,
      isLightTemplate: platform === "META" && client.template === "LIGHT",
    });

    const filePath = await saveReportFile(report.id, pptxBuffer);

    // Replaces the small create-time summaryJson above with the full
    // payload the public share page reads (lib/nre/share-report.ts) — done
    // here, not at create time, so a report that ends up FAILED never gets
    // a share page's worth of (possibly stale-looking) data attached to it.
    const shareData = buildShareReportData(data, aiCopyBySlideKey, new Date(), {
      currencySymbol,
      agencyName: user?.agencyName,
    });

    await prisma.report.update({
      where: { id: report.id },
      data: { status: "COMPLETE", filePath, summaryJson: JSON.stringify(shareData) },
    });

    // Saving to Google Drive is a separate, explicit action the user takes
    // from the download screen (see /api/reports/[id]/save-to-drive) — the
    // report is already fully generated and downloadable at this point.
    return NextResponse.json({ ok: true, reportId: report.id, shareToken: report.shareToken });
  } catch (err) {
    console.error("[api:reports:generate] failed:", err);
    const message = err instanceof Error ? err.message : "Report generation failed.";
    try {
      await prisma.report.update({
        where: { id: report.id },
        data: { status: "FAILED", errorMessage: message },
      });
    } catch (updateErr) {
      console.error("[api:reports:generate] failed to record failure status:", updateErr);
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const bulkDeleteSchema = z.object({ reportIds: z.array(z.string()).min(1) });

/** Bulk-deletes reports for the report-history list's multi-select — scopes the delete to reports that both match a requested id AND belong to this client (which itself must belong to the current user), the same ownership check as the single-report DELETE route just applied to a whole set at once. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  let client;
  try {
    client = await prisma.client.findUnique({ where: { id } });
  } catch (err) {
    return apiErrorResponse(err, "reports:bulk-delete:lookup");
  }
  if (!client || client.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = bulkDeleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "reportIds is required." }, { status: 400 });
  }

  try {
    const reports = await prisma.report.findMany({
      where: { id: { in: parsed.data.reportIds }, clientId: client.id },
      select: { id: true, filePath: true },
    });

    // Best-effort blob cleanup — same tolerance as the single-report DELETE route.
    await Promise.all(reports.filter((r) => r.filePath).map((r) => deleteReportFile(r.filePath!)));
    await prisma.report.deleteMany({ where: { id: { in: reports.map((r) => r.id) } } });

    return NextResponse.json({ ok: true, deletedCount: reports.length });
  } catch (err) {
    return apiErrorResponse(err, "reports:bulk-delete");
  }
}
