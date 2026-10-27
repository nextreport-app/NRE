import { NextResponse } from "next/server";
import { processTrialLifecycle } from "@/lib/trial-lifecycle";
import { apiErrorResponse } from "@/lib/api-error";
export const maxDuration = 300;
/** Daily around 14:30 IST; final-day reminder plus expiry notification and delivery recovery. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await processTrialLifecycle();
    return NextResponse.json({ ok: result.failures === 0, ...result }, { status: result.failures ? 503 : 200 });
  } catch (err) { return apiErrorResponse(err, "cron:trial-lifecycle"); }
}
