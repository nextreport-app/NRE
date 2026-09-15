import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { accountSettingsSchema } from "@/lib/validators/account";
import { apiErrorResponse } from "@/lib/api-error";
import {
  allowedReportRetentionOptions,
  normalizeReportRetentionDays,
} from "@/lib/report-retention";
import { getSubscriptionStatus } from "@/lib/subscription";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        agencyName: true,
        googleDriveEnabled: true,
        googleConnectedEmail: true,
        reportRetentionDays: true,
        planId: true,
        trialEndsAt: true,
        email: true,
      },
    });
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const status = getSubscriptionStatus(user);
    const retentionOptions = allowedReportRetentionOptions(status.planId);

    return NextResponse.json({
      agencyName: user.agencyName ?? null,
      googleDriveEnabled: user.googleDriveEnabled ?? false,
      googleConnectedEmail: user.googleConnectedEmail ?? null,
      reportRetentionDays: normalizeReportRetentionDays(user.reportRetentionDays, status.planId),
      reportRetentionOptions: retentionOptions,
    });
  } catch (err) {
    return apiErrorResponse(err, "account:get");
  }
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = accountSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const data: { agencyName?: string | null; reportRetentionDays?: number } = {};
  if (parsed.data.agencyName !== undefined) data.agencyName = parsed.data.agencyName;

  if (parsed.data.reportRetentionDays !== undefined) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { planId: true, trialEndsAt: true, email: true },
    });
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const status = getSubscriptionStatus(user);
    const allowed = allowedReportRetentionOptions(status.planId);
    if (!allowed.includes(parsed.data.reportRetentionDays as (typeof allowed)[number])) {
      return NextResponse.json(
        {
          error: `Your plan allows report retention up to ${allowed[allowed.length - 1]} days.`,
        },
        { status: 400 },
      );
    }
    data.reportRetentionDays = parsed.data.reportRetentionDays;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: true });
  }

  try {
    await prisma.user.update({ where: { id: session.user.id }, data });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err, "account:update");
  }
}
