import { NextResponse } from "next/server";
import { z } from "zod";
import { findUserByEmail } from "@/lib/find-user-by-email";
import { apiErrorResponse } from "@/lib/api-error";

const bodySchema = z.object({
  email: z.string().email(),
});

/**
 * After a failed credentials login, refines UX for Google-only accounts (no passwordHash yet).
 * Does not reveal whether the email exists when a password is already set.
 */
export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ hint: "credentials" as const });
    }

    const user = await findUserByEmail(parsed.data.email, {
      id: true,
      passwordHash: true,
    });

    if (user && !user.passwordHash) {
      return NextResponse.json({ hint: "oauth_only" as const });
    }

    return NextResponse.json({ hint: "credentials" as const });
  } catch (err) {
    return apiErrorResponse(err, "auth:account-login-hint");
  }
}
