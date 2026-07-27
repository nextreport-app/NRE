import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseUploadedFile } from "@/lib/nre/parse-file";
import { validateMtdDailyCsv } from "@/lib/nre/validate";
import { buildReportData } from "@/lib/nre/report-data";
import { CURRENCY_SYMBOLS } from "@/lib/nre/format";
import { aiKeysFromEnv } from "@/lib/ai/client";
import { generateInsights } from "@/lib/ai/generate-insights";
import { renderPptx } from "@/lib/pptx/render";
import type { ImageAsset } from "@/lib/pptx/embed-image";
import { loadTemplateBuffer } from "@/lib/pptx/templates";
import { saveReportFile, readLogoFile } from "@/lib/storage";
import { apiErrorResponse } from "@/lib/api-error";
import { fileFromFormData } from "@/lib/http-file";
import { resolveDateSelection } from "@/lib/nre/resolve-date-selection";
import { autoSaveReportToDrive } from "@/lib/google-drive";
import { contentTypeForLogoFormat, detectLogoFormat, extensionForLogoFormat, readLogoDimensions } from "@/lib/logo-processing";
import {
  dateSelectionSchema,
  parseJsonFormField,
  reportTitleSchema,
  selectedCampaignsSchema,
} from "@/lib/validators/report-wizard";

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

  const formData = await req.formData().catch(() => null);
  const mtdDailyBuffer = formData ? await fileFromFormData(formData, "mtdDailyCsv") : null;
  const periodBuffer = formData ? await fileFromFormData(formData, "periodCsv") : null;

  if (!mtdDailyBuffer || mtdDailyBuffer.length === 0) {
    return NextResponse.json({ error: "MTD Daily CSV is required." }, { status: 400 });
  }

  const mtdParsed = parseUploadedFile(mtdDailyBuffer, "MTD Daily CSV");
  const validation = validateMtdDailyCsv(mtdParsed.colMap, mtdParsed.rows, undefined, mtdParsed.headers);
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.errors.map((e) => e.message).join(" ") },
      { status: 400 },
    );
  }

  const selectedCampaigns = formData ? parseJsonFormField(formData, "selectedCampaigns", selectedCampaignsSchema) : undefined;
  const dateSelection = formData ? parseJsonFormField(formData, "dateSelection", dateSelectionSchema) : undefined;
  const reportTitle = formData ? parseJsonFormField(formData, "reportTitle", reportTitleSchema) : undefined;

  const dateResolution = resolveDateSelection(mtdParsed.rows, dateSelection);
  if (!dateResolution.ok) {
    return NextResponse.json({ error: dateResolution.error || "Invalid date selection." }, { status: 400 });
  }

  const periodParsed = periodBuffer && periodBuffer.length > 0 ? parseUploadedFile(periodBuffer, "Period CSV") : null;
  const currencySymbol = CURRENCY_SYMBOLS[client.currency];

  const data = buildReportData({
    accountName: client.accountName,
    currencySymbol,
    timezone: client.timezone,
    monthlyBudget: client.monthlyBudget,
    mtdDailyRows: mtdParsed.rows,
    periodRows: periodParsed?.rows,
    selectedCampaigns: selectedCampaigns ?? null,
    weeklyRange: dateResolution.weeklyRange,
  });

  const [weekStart, weekEnd] = data.fileDateRange.includes(" to ")
    ? data.fileDateRange.split(" to ")
    : [undefined, undefined];
  const fileName = "Meta Ads Report - " + data.fileDateRange.replace(/[\s/]/g, "_") + ".pptx";

  let report;
  try {
    report = await prisma.report.create({
      data: {
        clientId: client.id,
        status: "GENERATING",
        weekStart,
        weekEnd,
        fileName,
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
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          agencyName: true,
          googleDriveEnabled: true,
          googleDriveFolderName: true,
          googleRefreshToken: true,
        },
      }),
      loadLogoAsset(client.logoUrl),
    ]);

    const templateBuffer = await loadTemplateBuffer(client.template);
    const pptxBuffer = await renderPptx({
      templateBuffer,
      data,
      currencySymbol,
      aiCopyBySlideKey,
      reportTitle,
      agencyName: user?.agencyName,
      clientLogo,
    });

    const filePath = await saveReportFile(report.id, pptxBuffer);

    await prisma.report.update({
      where: { id: report.id },
      data: { status: "COMPLETE", filePath },
    });

    // Auto-save is best-effort and never fails the request: the PPTX is
    // already generated and downloadable regardless of what happens here.
    // `driveAutoSave` stays null when the feature is off entirely, so the
    // wizard's download screen can tell "disabled" apart from "attempted
    // and failed" and render the right one of its three states.
    let driveAutoSave: { status: "success"; url: string } | { status: "error"; message: string } | null = null;
    if (user?.googleDriveEnabled) {
      if (!user.googleRefreshToken) {
        driveAutoSave = {
          status: "error",
          message: "Google Drive auto-save is enabled, but no Google account is connected. Connect one in Account Settings.",
        };
      } else {
        try {
          const { webViewLink } = await autoSaveReportToDrive({
            refreshToken: user.googleRefreshToken,
            rootFolderName: user.googleDriveFolderName,
            clientName: client.accountName,
            fileName: fileName.replace(/\.pptx$/i, ""),
            pptxBuffer,
          });
          driveAutoSave = { status: "success", url: webViewLink };
          // Same cache field the manual "Get Google Slides Link" button
          // uses — keeps the two features from ever creating two separate
          // Drive files for the same report.
          await prisma.report.update({ where: { id: report.id }, data: { slidesUrl: webViewLink } });
        } catch (err) {
          console.error("[api:reports:generate] Google Drive auto-save failed:", err);
          driveAutoSave = {
            status: "error",
            message: err instanceof Error ? err.message : "Google Drive upload failed.",
          };
        }
      }
    }

    return NextResponse.json({ ok: true, reportId: report.id, driveAutoSave });
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
