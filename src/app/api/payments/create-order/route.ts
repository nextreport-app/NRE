import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isPlanId, PLANS, razorpayClient } from "@/lib/razorpay";
import { apiErrorResponse } from "@/lib/api-error";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const planId = body?.planId;
  if (!isPlanId(planId)) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const plan = PLANS[planId];

  try {
    const order = await razorpayClient().orders.create({
      amount: plan.amountPaise,
      currency: "INR",
      // Razorpay caps receipt at 40 chars — truncate defensively even
      // though userId (cuid) + planId + timestamp normally fits.
      receipt: `${planId}_${session.user.id}_${Date.now()}`.slice(0, 40),
      notes: { userId: session.user.id, planId },
    });

    return NextResponse.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      planId,
    });
  } catch (err) {
    return apiErrorResponse(err, "payments:create-order");
  }
}
