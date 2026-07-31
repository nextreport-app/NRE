import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { waitlistSchema } from "@/lib/validators/waitlist";
import { apiErrorResponse } from "@/lib/api-error";

/**
 * International (non-INR) pricing waitlist. No longer linked from
 * /pricing — Razorpay's international-card support now handles USD
 * checkout there directly (see components/subscribe-button.tsx) — but this
 * route is left in place rather than removed. Deliberately public: most
 * visitors here would be anonymous marketing-page traffic, not logged-in
 * accounts, so there's no auth() check the way the Razorpay routes have
 * one.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = waitlistSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const { email, planId, country } = parsed.data;

  try {
    // Upsert, not create: resubmitting the same email (e.g. revisiting
    // the pricing page and picking a different plan) updates which plan/
    // country was last associated with it instead of erroring out on the
    // unique email constraint or creating a duplicate row.
    await prisma.waitlistEntry.upsert({
      where: { email },
      create: { email, planId, country },
      update: { planId, country },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err, "waitlist:join");
  }
}
