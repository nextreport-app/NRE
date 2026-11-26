import { NextResponse } from "next/server";
import { retryPendingEmails } from "@/lib/email-delivery";
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
  return NextResponse.json(
    await retryPendingEmails(30, ["PERFORMANCE_ALERT", "BUDGET_ALERT"]),
  );
}
