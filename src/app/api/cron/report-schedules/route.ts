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
    await prisma.reportSchedulerState.upsert({
      where: { id: "main" },
      create: { id: "main", checkedAt: new Date() },
      update: { checkedAt: new Date() },
    });
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
    return NextResponse.json({
      ok: true,
      enqueued,
      processed,
      remaining: pending.length - processed,
    });
  } catch (error) {
    return apiErrorResponse(error, "cron:report-schedules");
  }
}
