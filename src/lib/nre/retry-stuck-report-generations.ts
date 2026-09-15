/**
 * Re-dispatch reports stuck in GENERATING — safety net when the async worker
 * times out or the dispatch fetch fails. Called from the daily purge cron
 * (Hobby-compatible) rather than a sub-daily Vercel cron schedule.
 */

import { prisma } from "@/lib/prisma";
import { dispatchReportGenerationJob } from "@/lib/nre/dispatch-report-generation-job";

export const STUCK_REPORT_AFTER_MS = 10 * 60 * 1000;

export async function retryStuckReportGenerations(limit = 20): Promise<number> {
  const cutoff = new Date(Date.now() - STUCK_REPORT_AFTER_MS);
  const stuck = await prisma.report.findMany({
    where: {
      status: "GENERATING",
      jobPayload: { not: null },
      updatedAt: { lt: cutoff },
    },
    select: { id: true },
    take: limit,
  });

  for (const report of stuck) {
    await dispatchReportGenerationJob(report.id);
  }

  return stuck.length;
}
