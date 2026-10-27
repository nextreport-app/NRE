import { NextResponse } from "next/server";
import { verifyEmailToken } from "@/lib/email-verification";
import { enforceRateLimit, requestAddress } from "@/lib/usage-rate-limit";
import { apiErrorResponse } from "@/lib/api-error";
export async function POST(req: Request) {
  const throttle = await enforceRateLimit("email-verify", requestAddress(req), 30, 600);
  if (throttle) return throttle;
  try {
    const body = await req.json().catch(() => null);
    if (typeof body?.token !== "string" || !/^[a-f0-9]{64}$/.test(body.token) || !(await verifyEmailToken(body.token))) return NextResponse.json({ error: "Verification link is invalid or expired. Log in to request another." }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (err) { return apiErrorResponse(err, "auth:verify-email"); }
}
