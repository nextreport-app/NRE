import { ServiceError } from "@/lib/service-error";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/usage-rate-limit";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { amountForCurrency, isBillingInterval, isPlanId, isPricingCurrency, razorpayClient } from "@/lib/razorpay";
import { apiErrorResponse } from "@/lib/api-error";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const throttle = await enforceRateLimit("billing-checkout", session.user.id, 5, 600);
  if (throttle) return throttle;
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
    const order = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${session.user.id} FOR UPDATE`;
      const user = await tx.user.findUniqueOrThrow({ where: { id: session.user.id } });
      if (user.paidThrough && user.paidThrough > new Date()) throw new ServiceError("You already have paid access. Contact support before changing plans to avoid duplicate charges.", 409);
      const pending = await tx.billingCheckout.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
      if (pending?.kind === "subscription") {
        const remote = await razorpayClient().subscriptions.fetch(pending.id);
        if (["created", "authenticated", "active", "pending"].includes(remote.status)) throw new ServiceError("A recurring checkout is already open. Contact support before changing checkout type.", 409);
      }
      if (pending?.kind === "order" && !(await tx.billingPayment.findFirst({ where: { checkoutId: pending.id } }))) {
        if (pending.planId !== planId || pending.currency !== currency || pending.interval !== interval || pending.amount !== amountForCurrency(planId, currency, interval)) throw new ServiceError("A checkout is already open for a different plan. Contact support before starting another purchase.", 409);
        return razorpayClient().orders.fetch(pending.id);
      }
      const created = await razorpayClient().orders.create({
        amount: amountForCurrency(planId, currency, interval), currency,
        receipt: `${planId}_${session.user.id}_${Date.now()}`.slice(0, 40),
        notes: { userId: session.user.id, planId, currency, interval },
      });
      await tx.billingCheckout.create({ data: { id: created.id, userId: session.user.id, kind: "order", planId, currency, interval, amount: amountForCurrency(planId, currency, interval) } });
      return created;
    }, { timeout: 20000 });

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
