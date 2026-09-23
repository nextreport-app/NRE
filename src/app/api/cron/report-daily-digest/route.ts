import { NextResponse } from "next/server";
import { sendAdminDailyReportDigest } from "@/lib/admin-report-digest";

/**
 * Daily cron — one team email summarizing reports generated today (IST).
 * Schedule: 18:29 UTC = 11:59 PM IST (see vercel.json).
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

  const { sent, stats } = await sendAdminDailyReportDigest();
  return NextResponse.json({
    ok: true,
    sent,
    day: stats.dayLabel,
    total: stats.total,
    activeUsers: stats.activeUsers,
  });
}
