import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseCsvText } from "@/lib/nre/parse-csv";
import { validateMtdDailyCsv } from "@/lib/nre/validate";
import { buildReportData } from "@/lib/nre/report-data";
import { CURRENCY_SYMBOLS } from "@/lib/nre/format";
import { generateInsights } from "@/lib/ai/generate-insights";
import { renderPptx } from "@/lib/pptx/render";
import { loadTemplateBuffer } from "@/lib/pptx/templates";
import { saveReportFile } from "@/lib/storage";
import { apiErrorResponse } from "@/lib/api-error";

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

  const body = await req.json().catch(() => null);
  const mtdDailyCsv = typeof body?.mtdDailyCsv === "string" ? body.mtdDailyCsv : "";
  const periodCsv = typeof body?.periodCsv === "string" ? body.periodCsv : "";

  if (!mtdDailyCsv.trim()) {
    return NextResponse.json({ error: "MTD Daily CSV is required." }, { status: 400 });
  }

  const mtdParsed = parseCsvText(mtdDailyCsv);
  const validation = validateMtdDailyCsv(mtdParsed.colMap, mtdParsed.rows, undefined, mtdParsed.headers);
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.errors.map((e) => e.message).join(" ") },
      { status: 400 },
    );
  }

  const periodParsed = periodCsv.trim() ? parseCsvText(periodCsv) : null;
  const currencySymbol = CURRENCY_SYMBOLS[client.currency];

  const data = buildReportData({
    accountName: client.accountName,
    currencySymbol,
    timezone: client.timezone,
    monthlyBudget: client.monthlyBudget,
    mtdDailyRows: mtdParsed.rows,
    periodRows: periodParsed?.rows,
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
    const aiCopyBySlideKey = await generateInsights(data, {
      groqApiKey: client.groqApiKey,
      geminiApiKey: client.geminiApiKey,
    });

    const templateBuffer = await loadTemplateBuffer(client.template);
    const pptxBuffer = await renderPptx({ templateBuffer, data, currencySymbol, aiCopyBySlideKey });

    const filePath = await saveReportFile(report.id, pptxBuffer);

    await prisma.report.update({
      where: { id: report.id },
      data: { status: "COMPLETE", filePath },
    });

    return NextResponse.json({ ok: true, reportId: report.id });
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
