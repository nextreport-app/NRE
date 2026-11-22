import { after, NextResponse } from "next/server";
import { z } from "zod";
import { enforceRateLimit } from "@/lib/usage-rate-limit";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ServiceError } from "@/lib/service-error";
import { apiErrorResponse } from "@/lib/api-error";
import { schedulerHealth } from "@/lib/report-schedules/health";
import { scheduleSettingsSchema } from "@/lib/report-schedules/calendar";
import { reportApprovalDigest } from "@/lib/report-schedules/approval";
import {
  saveReportSchedule,
  createManualDraft,
  processScheduledRun,
  approveScheduledDraft,
  sendApprovedDraft,
  skipScheduledDraft,
} from "@/lib/report-schedules/service";
export const maxDuration = 300;
const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("save"),
    settings: scheduleSettingsSchema,
    enabled: z.boolean(),
  }),
  z.object({
    action: z.literal("toggle"),
    scheduleId: z.string().min(1),
    enabled: z.boolean(),
  }),
  z.object({ action: z.literal("prepare"), scheduleId: z.string().min(1) }),
  z.object({
    action: z.literal("approve"),
    runId: z.string().min(1),
    digest: z.string().regex(/^[a-f0-9]{64}$/),
    reviewed: z.literal(true),
  }),
  z.object({ action: z.literal("send"), runId: z.string().min(1) }),
  z.object({ action: z.literal("skip"), runId: z.string().min(1) }),
]);
async function owned(id: string, userId: string) {
  const client = await prisma.client.findUnique({ where: { id } });
  if (!client || client.userId !== userId)
    throw new ServiceError("Not found", 404);
  return client;
}
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const client = await owned(id, session.user.id);
    const schedules = await prisma.reportSchedule.findMany({
      where: { clientId: id },
      orderBy: { createdAt: "asc" },
      include: {
        runs: {
          take: 5,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            status: true,
            dueAt: true,
            error: true,
            sourceSessionId: true,
            settingsJson: true,
            deliveredAt: true,
            report: {
              select: {
                id: true,
                status: true,
                displayName: true,
                approvedAt: true,
                slidesUrl: true,
                shareToken: true,
                filePath: true,
                fileName: true,
                summaryJson: true,
              },
            },
          },
        },
      },
    });
    return NextResponse.json(
      {
        linked: !!client.metaAdAccountId,
        timezone: client.timezone,
        folderId: client.lastDriveFolderId,
        health: await schedulerHealth(),
        schedules: schedules.map((schedule) => ({
          id: schedule.id,
          enabled: schedule.enabled,
          nextRunAt: schedule.nextRunAt,
          settings: JSON.parse(schedule.settingsJson),
          runs: schedule.runs.map((run) => ({
            id: run.id,
            status: run.status,
            dueAt: run.dueAt,
            error: run.error,
            sourceSessionId: run.sourceSessionId,
            settings: JSON.parse(run.settingsJson).settings,
            deliveredAt: run.deliveredAt,
            report: run.report
              ? {
                  id: run.report.id,
                  status: run.report.status,
                  displayName: run.report.displayName,
                  approvedAt: run.report.approvedAt,
                  slidesUrl: run.report.slidesUrl,
                  shareToken: run.report.approvedAt
                    ? run.report.shareToken
                    : null,
                  digest:
                    run.report.status === "COMPLETE"
                      ? reportApprovalDigest(run.report)
                      : null,
                }
              : null,
          })),
        })),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiErrorResponse(error, "schedules:get");
  }
}
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    await owned(id, session.user.id);
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success)
      throw new ServiceError(
        "Check the schedule, recipient addresses and requested action.",
      );
    const input = parsed.data;
    if (input.action === "save") {
      await saveReportSchedule(
        id,
        session.user.id,
        input.settings,
        input.enabled,
      );
      return NextResponse.json({ ok: true });
    }
    if ("scheduleId" in input) {
      const schedule = await prisma.reportSchedule.findFirst({
        where: { id: input.scheduleId, clientId: id },
      });
      if (!schedule) throw new ServiceError("Not found", 404);
      if (input.action === "toggle") {
        await saveReportSchedule(
          id,
          session.user.id,
          JSON.parse(schedule.settingsJson),
          input.enabled,
        );
        return NextResponse.json({ ok: true });
      }
      const limited = await enforceRateLimit(
        "scheduled-report-prepare",
        session.user.id,
        3,
        60,
      );
      if (limited) return limited;
      const run = await createManualDraft(schedule.id, session.user.id);
      after(() => processScheduledRun(run.id));
      return NextResponse.json({ ok: true, runId: run.id }, { status: 202 });
    }
    const run = await prisma.scheduledReportRun.findFirst({
      where: { id: input.runId, schedule: { clientId: id } },
    });
    if (!run) throw new ServiceError("Not found", 404);
    if (input.action === "approve")
      await approveScheduledDraft(run.id, session.user.id, input.digest);
    else if (input.action === "skip")
      await skipScheduledDraft(run.id, session.user.id);
    else {
      const delivery = await sendApprovedDraft(run.id, session.user.id);
      return NextResponse.json({
        ok: delivery.accepted,
        pending: !delivery.accepted,
      });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, "schedules:change");
  }
}
