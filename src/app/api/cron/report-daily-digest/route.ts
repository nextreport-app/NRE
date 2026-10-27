import { apiErrorResponse } from "@/lib/api-error";
import { NextResponse } from "next/server";
import { sendAdminDailyReportDigest } from "@/lib/admin-report-digest";
export const maxDuration = 300;

/**
 * Daily cron — one team email summarizing reports generated yesterday (IST).
 * Schedule: 18:30 UTC = midnight IST (see vercel.json).
 * Requires CRON_SECRET bearer token.
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

  try {
  const { sent, skipped, error, recipients, stats, pending, alreadySent } = await sendAdminDailyReportDigest();

  if (pending) return NextResponse.json({ ok: true, pending: true, day: stats.dayLabel }, { status: 202 });
  if (!sent) {
    return NextResponse.json(
      {
        ok: false,
        sent,
        skipped,
        error: error ?? "Digest email was not sent",
        recipients,
        day: stats.dayLabel,
        total: stats.total,
        activeUsers: stats.activeUsers,
      },
      { status: skipped ? 503 : 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    sent,
    alreadySent,
    recipients,
    day: stats.dayLabel,
    total: stats.total,
    activeUsers: stats.activeUsers,
  });
  } catch (err) { return apiErrorResponse(err, "cron:report-daily-digest"); }
}
