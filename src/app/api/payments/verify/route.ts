import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isPlanId, verifyPaymentSignature } from "@/lib/razorpay";
import { apiErrorResponse } from "@/lib/api-error";

/**
 * The only place a user's plan actually changes. The frontend reporting a
 * successful Razorpay Checkout callback is NEVER sufficient on its own —
 * every payment is re-verified here, server-side, against Razorpay's own
 * HMAC-SHA256 signature scheme before touching the database. A request
 * with a missing/wrong/forged signature is rejected outright and the
 * user's plan is left untouched.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const { razorpay_payment_id, razorpay_order_id, razorpay_signature, planId } = body ?? {};

  if (
    typeof razorpay_payment_id !== "string" ||
    !razorpay_payment_id ||
    typeof razorpay_order_id !== "string" ||
    !razorpay_order_id ||
    typeof razorpay_signature !== "string" ||
    !razorpay_signature ||
    !isPlanId(planId)
  ) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    return NextResponse.json({ error: "Payments are not configured" }, { status: 500 });
  }

  const valid = verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature, keySecret);
  if (!valid) {
    return NextResponse.json({ error: "Signature mismatch" }, { status: 400 });
  }

  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { planId, subscribedAt: new Date() },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    return apiErrorResponse(err, "payments:verify");
  }
}
