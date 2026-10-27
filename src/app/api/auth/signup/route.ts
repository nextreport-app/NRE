import { enforceRateLimit, requestAddress } from "@/lib/usage-rate-limit";
import { sendVerificationEmail } from "@/lib/email-verification";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signupSchema } from "@/lib/validators/auth";
import { apiErrorResponse } from "@/lib/api-error";
import { notifyAdminNewSignup } from "@/lib/admin-signup-notification";
import { sendWelcomeTrialEmail } from "@/lib/billing-user-emails";
import { findUserByEmail } from "@/lib/find-user-by-email";

export async function POST(req: Request) {
  const throttle = await enforceRateLimit("signup", requestAddress(req), 5, 3600);
  if (throttle) return throttle;
  const body = await req.json().catch(() => null);
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const { name, email, password } = parsed.data;

  try {
    const existing = await findUserByEmail(email, { id: true });
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { name, email, passwordHash },
      select: { id: true, email: true, name: true, trialEndsAt: true, paidThrough: true, emailVerified: true },
    });

    await sendVerificationEmail(user.id).catch(err => console.error("[signup:verification]", err));
    notifyAdminNewSignup({ email, name, provider: "credentials" });
    await sendWelcomeTrialEmail({ userId: user.id, to: user.email, name: user.name, trialEndsAt: user.trialEndsAt }).catch(err => console.error("[signup:welcome-queue]", err));

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err, "signup");
  }
}
