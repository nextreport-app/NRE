import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiErrorResponse } from "@/lib/api-error";
import { schedulerHealth } from "@/lib/report-schedules/health";
import {
  INBOX_VIEWS,
  inboxCounts,
  inboxStatuses,
  inboxItem,
} from "@/lib/report-schedules/inbox";
const querySchema = z.object({
  view: z.enum(INBOX_VIEWS).default("todo"),
  q: z.string().trim().max(100).default(""),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const query = querySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!query.success)
    return NextResponse.json(
      { error: "Choose a valid inbox view, client search and page." },
      { status: 400 },
    );
  try {
    const { view, q } = query.data,
      scope = {
        schedule: {
          client: {
            userId: session.user.id,
            ...(q
              ? { accountName: { contains: q, mode: "insensitive" as const } }
              : {}),
          },
        },
      };
    const [groups, health] = await Promise.all([
      prisma.scheduledReportRun.groupBy({
        by: ["status"],
        where: scope,
        _count: { _all: true },
      }),
      schedulerHealth(),
    ]);
    const counts = inboxCounts(groups),
      total = counts[view],
      pages = Math.max(1, Math.ceil(total / 25)),
      page = Math.min(query.data.page, pages);
    const runs = await prisma.scheduledReportRun.findMany({
      where: { ...scope, status: inboxStatuses(view) },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      skip: (page - 1) * 25,
      take: 25,
      select: {
        id: true,
        status: true,
        dueAt: true,
        createdAt: true,
        deliveredAt: true,
        error: true,
        sourceSessionId: true,
        settingsJson: true,
        approvalDigest: true,
        schedule: {
          select: { client: { select: { id: true, accountName: true } } },
        },
        report: {
          select: {
            id: true,
            status: true,
            displayName: true,
            approvedAt: true,
            slidesUrl: true,
            shareToken: true,
            summaryJson: true,
            filePath: true,
            fileName: true,
          },
        },
      },
    });
    return NextResponse.json(
      { items: runs.map(inboxItem), counts, total, page, pages, health },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiErrorResponse(error, "report-inbox:get");
  }
}
