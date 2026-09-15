import { NextResponse } from "next/server";
import { retryStuckReportGenerations } from "@/lib/nre/retry-stuck-report-generations";

/** Manual/on-demand stuck-report recovery — not scheduled on Hobby (daily limit). */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const retried = await retryStuckReportGenerations();
  return NextResponse.json({ ok: true, retried });
}
