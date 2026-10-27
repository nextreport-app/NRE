import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/email-verification";
import { enforceRateLimit } from "@/lib/usage-rate-limit";
import { apiErrorResponse } from "@/lib/api-error";
export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const throttle = await enforceRateLimit("email-verification-send", session.user.id, 3, 3600);
  if (throttle) return throttle;
  try { await sendVerificationEmail(session.user.id); return NextResponse.json({ ok: true }); }
  catch (err) { return apiErrorResponse(err, "auth:resend-verification"); }
}
