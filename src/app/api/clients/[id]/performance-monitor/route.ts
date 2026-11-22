import {
  decisionPeriods,
  targetRulesSchema,
} from "@/lib/performance-monitor/settings";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiErrorResponse } from "@/lib/api-error";
import { ServiceError } from "@/lib/service-error";
import { checkClientPerformance } from "@/lib/performance-monitor/service";
export const maxDuration = 300;
const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("comparison"),
    days: z.union([z.literal(7), z.literal(15), z.literal(30)]),
    customStart: z.string().optional(),
    customEnd: z.string().optional(),
  }),
  z.object({ action: z.literal("targets"), rules: targetRulesSchema }),
  z.object({ action: z.literal("check") }),
  z.object({
    action: z.literal("settings"),
    enabled: z.boolean(),
    emailEnabled: z.boolean(),
  }),
]);
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const client = await prisma.client.findUnique({ where: { id } });
    if (!client || client.userId !== session.user.id)
      throw new ServiceError("Not found", 404);
    const input = schema.safeParse(await req.json().catch(() => null));
    if (!input.success)
      throw new ServiceError("Choose valid monitoring settings.");
    if (input.data.action === "comparison") {
      const settings = {
        performanceWindowDays: input.data.days,
        performanceCustomStart: input.data.customStart ?? null,
        performanceCustomEnd: input.data.customEnd ?? null,
      };
      try {
        decisionPeriods(client.timezone, settings);
      } catch (error) {
        throw new ServiceError(
          error instanceof Error ? error.message : "Choose valid dates.",
        );
      }
      await prisma.client.update({
        where: { id },
        data: {
          ...settings,
          performanceMonitorSnapshot: null,
          performanceMonitorLastAttemptAt: null,
          performanceMonitorLeaseUntil: null,
        },
      });
      return NextResponse.json({ ok: true });
    }
    if (input.data.action === "targets") {
      if (!client.metaAdAccountId)
        throw new ServiceError("Link a Meta account first.");
      const rules = Object.fromEntries(
        Object.entries(input.data.rules).sort(([a], [b]) => a.localeCompare(b)),
      );
      await prisma.client.update({
        where: { id },
        data: {
          performanceTargetRules: JSON.stringify({
            accountId: client.metaAdAccountId.replace(/^act_/, ""),
            currency: client.currency,
            rules,
          }),
          performanceMonitorSnapshot: null,
          performanceMonitorLastAttemptAt: null,
          performanceMonitorLeaseUntil: null,
        },
      });
      return NextResponse.json({ ok: true });
    }
    if (input.data.action === "settings") {
      if (input.data.enabled && !client.metaAdAccountId)
        throw new ServiceError(
          "Link this client's Meta ad account in Client settings first.",
        );
      await prisma.client.update({
        where: { id },
        data: {
          performanceMonitorEnabled: input.data.enabled,
          performanceMonitorEmailEnabled: input.data.emailEnabled,
        },
      });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json(
      { snapshot: await checkClientPerformance(id, session.user.id) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiErrorResponse(error, "performance:check");
  }
}
