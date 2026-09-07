import { NextResponse } from "next/server";
import { purgeExpiredReports } from "@/lib/report-retention";

/** Daily cron — removes reports older than 30 days. Requires CRON_SECRET bearer token. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const deleted = await purgeExpiredReports();
  return NextResponse.json({ ok: true, deleted });
}
