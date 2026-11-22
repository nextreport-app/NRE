import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ServiceError } from "@/lib/service-error";
import { apiErrorResponse } from "@/lib/api-error";
import { checkClientPerformance } from "@/lib/performance-monitor/service";
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
  try {
    const started = Date.now();
    let checked = 0,
      failed = 0,
      skipped = 0;
    const clients = await prisma.client.findMany({
      where: {
        performanceMonitorEnabled: true,
        performanceCustomStart: null,
        metaAdAccountId: { not: null },
        OR: [
          { performanceMonitorLastAttemptAt: null },
          {
            performanceMonitorLastAttemptAt: {
              lte: new Date(Date.now() - 15 * 60000),
            },
          },
        ],
      },
      orderBy: {
        performanceMonitorLastAttemptAt: { sort: "asc", nulls: "first" },
      },
      take: 50,
      select: { id: true, userId: true },
    });
    for (
      let offset = 0;
      offset < clients.length && Date.now() - started < 140000;
      offset += 3
    ) {
      await Promise.all(
        clients.slice(offset, offset + 3).map(async (client) => {
          try {
            const snapshot = await checkClientPerformance(
              client.id,
              client.userId,
            );
            if (snapshot.error) failed++;
          } catch (error) {
            if (
              error instanceof ServiceError &&
              [403, 404, 429].includes(error.status)
            )
              skipped++;
            else failed++;
          } finally {
            checked++;
          }
        }),
      );
    }
    return NextResponse.json(
      {
        ok: failed === 0,
        checked,
        failed,
        skipped,
        remaining: clients.length - checked,
      },
      { status: failed ? 503 : 200 },
    );
  } catch (error) {
    return apiErrorResponse(error, "cron:performance-monitor");
  }
}
