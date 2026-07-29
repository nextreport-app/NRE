import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiErrorResponse } from "@/lib/api-error";

/**
 * Marks the subscription cancelled — see lib/razorpay.ts's file header:
 * this integration uses Razorpay's one-time Orders API, not the
 * Subscriptions API, so there is no live Razorpay subscription object to
 * call a cancel API on. "Cancel" here means "stop granting paid access,"
 * recorded locally; it does not issue a refund or contact Razorpay.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { planId: "cancelled" },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err, "billing:cancel");
  }
}
