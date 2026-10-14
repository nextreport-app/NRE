import { NextResponse } from "next/server";
import { z } from "zod";
import { resetPasswordWithToken } from "@/lib/password-reset";
import { apiErrorResponse } from "@/lib/api-error";
import { signupSchema } from "@/lib/validators/auth";

const bodySchema = z.object({
  token: z.string().min(1, "Reset link is invalid."),
  password: signupSchema.shape.password,
});

export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid request.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const result = await resetPasswordWithToken(parsed.data.token, parsed.data.password);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      message: "Password updated. You can log in now.",
      email: result.email,
    });
  } catch (err) {
    return apiErrorResponse(err, "auth:reset-password");
  }
}
