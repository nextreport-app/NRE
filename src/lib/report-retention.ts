import { prisma } from "@/lib/prisma";
import { deleteReportFile } from "@/lib/storage";

/** Reports older than this are purged automatically (PPTX/PDF blobs + DB row). */
export const REPORT_RETENTION_DAYS = 30;

const BATCH_SIZE = 50;

/**
 * Deletes reports older than REPORT_RETENTION_DAYS — blobs first, then DB rows.
 * Returns total reports removed across all batches.
 */
export async function purgeExpiredReports(now = new Date()): Promise<number> {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - REPORT_RETENTION_DAYS);

  let total = 0;
  for (;;) {
    const batch = await prisma.report.findMany({
      where: { createdAt: { lt: cutoff } },
      select: { id: true, filePath: true, pdfPath: true },
      take: BATCH_SIZE,
    });
    if (batch.length === 0) break;

    await Promise.all(
      batch.map(async (report) => {
        if (report.filePath) await deleteReportFile(report.filePath).catch(() => undefined);
        if (report.pdfPath) await deleteReportFile(report.pdfPath).catch(() => undefined);
      }),
    );
    await prisma.report.deleteMany({ where: { id: { in: batch.map((r) => r.id) } } });
    total += batch.length;
    if (batch.length < BATCH_SIZE) break;
  }

  return total;
}
