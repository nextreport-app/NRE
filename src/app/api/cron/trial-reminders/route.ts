import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTrialEndingReminderEmail } from "@/lib/billing-user-emails";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Daily cron — emails trial users whose trial ends in ~24 hours.
 * Requires CRON_SECRET bearer token (see vercel.json).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  const windowStart = new Date(now + MS_PER_DAY);
  const windowEnd = new Date(now + 2 * MS_PER_DAY);

  const due = await prisma.user.findMany({
    where: {
      planId: "trial",
      trialEndingEmailSentAt: null,
      trialEndsAt: { gte: windowStart, lt: windowEnd },
    },
    select: { id: true, email: true, name: true, trialEndsAt: true },
    take: 200,
  });

  let sent = 0;
  for (const user of due) {
    sendTrialEndingReminderEmail({ to: user.email, name: user.name, trialEndsAt: user.trialEndsAt });
    await prisma.user.update({
      where: { id: user.id },
      data: { trialEndingEmailSentAt: new Date() },
    });
    sent += 1;
  }

  return NextResponse.json({ ok: true, sent, checked: due.length });
}
