import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dispatchReportGenerationJob } from "@/lib/nre/dispatch-report-generation-job";

const STUCK_AFTER_MS = 10 * 60 * 1000;

/** Re-dispatch reports stuck in GENERATING with a job payload (worker timeout/crash recovery). */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - STUCK_AFTER_MS);
  const stuck = await prisma.report.findMany({
    where: {
      status: "GENERATING",
      jobPayload: { not: null },
      updatedAt: { lt: cutoff },
    },
    select: { id: true },
    take: 20,
  });

  for (const report of stuck) {
    await dispatchReportGenerationJob(report.id);
  }

  return NextResponse.json({ ok: true, retried: stuck.length });
}
