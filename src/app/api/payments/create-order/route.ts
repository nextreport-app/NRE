import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { amountForCurrency, isPlanId, isPricingCurrency, razorpayClient } from "@/lib/razorpay";
import { apiErrorResponse } from "@/lib/api-error";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const planId = body?.planId;
  if (!isPlanId(planId)) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }
  // Defaults to INR for older clients that don't send a currency yet —
  // every current caller (SubscribeButton) always sends one explicitly.
  const currency = isPricingCurrency(body?.currency) ? body.currency : "INR";

  try {
    const order = await razorpayClient().orders.create({
      amount: amountForCurrency(planId, currency),
      currency,
      // Razorpay caps receipt at 40 chars — truncate defensively even
      // though userId (cuid) + planId + timestamp normally fits.
      receipt: `${planId}_${session.user.id}_${Date.now()}`.slice(0, 40),
      notes: { userId: session.user.id, planId, currency },
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
