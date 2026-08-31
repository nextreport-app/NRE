import { deleteReportFile, readReportFile, saveReportPdf } from "@/lib/storage";
import type { ShareReportData } from "@/lib/nre/share-report";
import { renderReportPdfFromShareData } from "./render-report-pdf";

export function isPdfExportAllowed(share: ShareReportData | null): boolean {
  if (!share?.publishedAt) return false;
  return Array.isArray(share.campaigns);
}

/** Generates (or regenerates) the PDF blob for a published report. Returns null when export is not allowed or rendering fails. */
export async function generateReportPdf(params: {
  reportId: string;
  shareToken: string;
  share: ShareReportData;
  previousPdfPath?: string | null;
}): Promise<string | null> {
  if (!isPdfExportAllowed(params.share)) return null;

  try {
    const buffer = await renderReportPdfFromShareData(params.share);
    if (params.previousPdfPath) {
      await deleteReportFile(params.previousPdfPath).catch(() => undefined);
    }
    return await saveReportPdf(params.reportId, buffer);
  } catch (err) {
    console.error("[pdf] generate failed:", err);
    return null;
  }
}

export async function readStoredReportPdf(url: string): Promise<Buffer> {
  return readReportFile(url);
}
