import { retryPendingEmails } from "@/lib/email-delivery";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiErrorResponse } from "@/lib/api-error";
import {
  enqueueDueSchedules,
  processScheduledRun,
  retryScheduledDelivery,
} from "@/lib/report-schedules/service";
export const maxDuration = 300;
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret)
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 503 },
    );
  if (req.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (process.env.REPORT_SCHEDULER_ENABLED !== "true")
    return NextResponse.json(
      { error: "Automatic report preparation is not enabled." },
      { status: 503 },
    );
  try {
    const started = Date.now();
    const enqueued = await enqueueDueSchedules();
    const pending = await prisma.scheduledReportRun.findMany({
      where: {
        OR: [
          { status: "SENDING" },
          {
            status: { in: ["PENDING", "PREPARING", "GENERATING"] },
            OR: [
              { leaseUntil: null },
              { leaseUntil: { lte: new Date() } },
              { report: { status: { in: ["COMPLETE", "FAILED"] } } },
            ],
          },
        ],
      },
      orderBy: { updatedAt: "asc" },
      take: 15,
    });
    let processed = 0;
    for (const run of pending) {
      if (Date.now() - started > 45000) break;
      if (run.status === "SENDING") await retryScheduledDelivery(run.id);
      else await processScheduledRun(run.id);
      processed++;
    }
    // Recover existing immutable delivery intents; this does not approve or
    // initiate a client send. Leave time for the function to finish cleanly.
    const emailRetries =
      Date.now() - started < 50000
        ? await retryPendingEmails(10)
        : { checked: 0, accepted: 0, failed: 0, skipped: true };
    await prisma.reportSchedulerState.upsert({
      where: { id: "main" },
      create: { id: "main", checkedAt: new Date() },
      update: { checkedAt: new Date() },
    });
    return NextResponse.json({
      ok: true,
      emailRetries,
      enqueued,
      processed,
      remaining: pending.length - processed,
    });
  } catch (error) {
    return apiErrorResponse(error, "cron:report-schedules");
  }
}
