import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readStoredReportPdf } from "@/lib/pdf/generate-report-pdf";
import { apiErrorResponse } from "@/lib/api-error";
import type { ShareReportData } from "@/lib/nre/share-report";

function parseShareJson(raw: string | null): ShareReportData | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.version !== 1 || !Array.isArray(parsed.campaigns)) return null;
    return parsed as ShareReportData;
  } catch {
    return null;
  }
}

function pdfFileName(pptxName: string | null): string {
  if (pptxName && pptxName.toLowerCase().endsWith(".pptx")) {
    return pptxName.replace(/\.pptx$/i, ".pdf");
  }
  return "report.pdf";
}

/** Authenticated PDF download — only after Review → Publish (publishedAt set). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const report = await prisma.report.findUnique({ where: { id }, include: { client: true } });
    if (!report || report.client.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const share = parseShareJson(report.summaryJson);
    if (!share?.publishedAt) {
      return NextResponse.json(
        { error: "Review and publish your report before downloading PDF." },
        { status: 409 },
      );
    }
    if (!report.pdfPath) {
      return NextResponse.json(
        { error: "PDF is not ready yet. Publish again from Review before sharing." },
        { status: 409 },
      );
    }

    const buffer = await readStoredReportPdf(report.pdfPath);
    const fileName = pdfFileName(report.fileName);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName.replace(/"/g, "")}"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (err) {
    return apiErrorResponse(err, "reports:download-pdf");
  }
}
