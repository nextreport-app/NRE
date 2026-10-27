import { enforceRateLimit, requestAddress } from "@/lib/usage-rate-limit";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requestPasswordReset } from "@/lib/password-reset";
import { apiErrorResponse } from "@/lib/api-error";

const bodySchema = z.object({
  email: z.string().email("Enter a valid email address."),
});

const GENERIC_OK = {
  message: "If an account exists with that email, we sent reset instructions.",
};

export async function POST(req: Request) {
  const throttle = await enforceRateLimit("forgot-password", requestAddress(req), 10, 900);
  if (throttle) return throttle;
  try {
    const json = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid email." }, { status: 400 });
    }

    await requestPasswordReset(parsed.data.email);
    return NextResponse.json(GENERIC_OK);
  } catch (err) {
    return apiErrorResponse(err, "auth:forgot-password");
  }
}
