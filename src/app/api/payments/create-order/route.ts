import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { amountForCurrency, isBillingInterval, isPlanId, isPricingCurrency, razorpayClient } from "@/lib/razorpay";
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
  const interval = isBillingInterval(body?.interval) ? body.interval : "monthly";

  try {
    const order = await razorpayClient().orders.create({
      amount: amountForCurrency(planId, currency, interval),
      currency,
      receipt: `${planId}_${session.user.id}_${Date.now()}`.slice(0, 40),
      notes: { userId: session.user.id, planId, currency, interval },
    });

    return NextResponse.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      planId,
      interval,
    });
  } catch (err) {
    return apiErrorResponse(err, "payments:create-order");
  }
}
