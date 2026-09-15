import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/api-error";
import { isBillingInterval, isPlanId, isPricingCurrency } from "@/lib/razorpay";
import { createRazorpaySubscription, isRazorpaySubscriptionsConfigured } from "@/lib/razorpay-subscriptions";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isRazorpaySubscriptionsConfigured()) {
    return NextResponse.json(
      { error: "Recurring subscriptions are not configured.", useOrders: true },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => null);
  const planId = body?.planId;
  if (!isPlanId(planId)) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const currency = isPricingCurrency(body?.currency) ? body.currency : "INR";
  const interval = isBillingInterval(body?.interval) ? body.interval : "monthly";
  const email = session.user.email;
  if (!email) {
    return NextResponse.json({ error: "Account email is required for billing." }, { status: 400 });
  }

  try {
    const result = await createRazorpaySubscription({
      userId: session.user.id,
      email,
      name: session.user.name,
      planId,
      currency,
      interval,
    });

    return NextResponse.json({
      mode: "subscription",
      subscription_id: result.subscriptionId,
      planId: result.planId,
      interval: result.interval,
      currency: result.currency,
    });
  } catch (err) {
    return apiErrorResponse(err, "payments:create-subscription");
  }
}
