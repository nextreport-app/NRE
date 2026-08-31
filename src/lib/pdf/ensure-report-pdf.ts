import { prisma } from "@/lib/prisma";
import { generateReportPdf, readStoredReportPdf } from "@/lib/pdf/generate-report-pdf";
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

/**
 * Returns a PDF buffer for a published report — uses cached Blob when present,
 * otherwise generates on demand (publish-time capture can fail if Chromium is cold).
 */
export async function ensureReportPdfBuffer(report: {
  id: string;
  shareToken: string | null;
  summaryJson: string | null;
  pdfPath: string | null;
}): Promise<Buffer | null> {
  const share = parseShareJson(report.summaryJson);
  if (!share?.publishedAt || !report.shareToken) return null;

  if (report.pdfPath) {
    return readStoredReportPdf(report.pdfPath);
  }

  const pdfPath = await generateReportPdf({
    reportId: report.id,
    shareToken: report.shareToken,
    share,
    previousPdfPath: null,
  });
  if (!pdfPath) return null;

  await prisma.report.update({
    where: { id: report.id },
    data: { pdfPath },
  });

  return readStoredReportPdf(pdfPath);
}

/** True once the agency has published — PDF may be generated lazily on first download. */
export function canDownloadReportPdf(share: ShareReportData | null): boolean {
  return !!share?.publishedAt;
}
