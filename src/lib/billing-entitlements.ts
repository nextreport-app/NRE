import { prisma } from "./prisma";
import { amountForCurrency, isBillingInterval, isPlanId, isPricingCurrency, getRazorpayPlanId, razorpayClient } from "./razorpay";
import { ServiceError } from "./service-error";

/** Calendar billing period, clamped at month-end rather than spilling into the next month. */
export function billingPeriodEnd(start: Date, interval: "monthly" | "annual"): Date {
  const end = new Date(start);
  const day = end.getUTCDate();
  end.setUTCDate(1);
  end.setUTCMonth(end.getUTCMonth() + (interval === "annual" ? 12 : 1));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();
  end.setUTCDate(Math.min(day, last));
  return end;
}

/** HMAC proves authenticity, not purchaser ownership/tier/amount/capture or entitlement duration. */
export async function applyCapturedPayment(paymentId: string, checkoutId: string, expectedUserId?: string) {
  const checkout = await prisma.billingCheckout.findUnique({ where: { id: checkoutId } });
  if (!checkout || (expectedUserId && checkout.userId !== expectedUserId)) throw new ServiceError("Checkout does not belong to this account.", 403);
  if (!isPlanId(checkout.planId) || !isPricingCurrency(checkout.currency) || !isBillingInterval(checkout.interval)) throw new ServiceError("Invalid billing configuration.", 409);
  const interval = checkout.interval;
  const payment = await razorpayClient().payments.fetch(paymentId);
  if (payment.status !== "captured" || payment.currency !== checkout.currency || Number(payment.amount) !== checkout.amount) throw new ServiceError("Payment is not captured for the expected amount and currency.", 409);
  if (checkout.amount !== amountForCurrency(checkout.planId, checkout.currency, checkout.interval)) throw new ServiceError("Checkout price no longer matches the catalogue. Contact support.", 409);

  let providerEnd: Date | null = null;
  if (checkout.kind === "subscription") {
    const sub = await razorpayClient().subscriptions.fetch(checkoutId);
    const expectedPlan = getRazorpayPlanId(checkout.planId, checkout.currency, checkout.interval);
    if (sub.plan_id !== expectedPlan || !["active", "pending"].includes(sub.status)) throw new ServiceError("Subscription is not active for the expected plan.", 409);
    // A payment from another subscription must never renew this entitlement.
    if (!payment.invoice_id) throw new ServiceError("Subscription invoice is not available yet. Please retry.", 409);
    const invoice = await razorpayClient().invoices.fetch(payment.invoice_id) as { subscription_id?: string; billing_end?: number | null };
    if (invoice.subscription_id !== checkoutId) throw new ServiceError("Payment is for a different subscription.", 403);
    if (!sub.current_end) throw new ServiceError("Subscription billing period is not available yet.", 409);
    const paidAt = new Date(Number(payment.created_at) * 1000);
    const invoiceEnd = invoice.billing_end ? new Date(invoice.billing_end * 1000) : billingPeriodEnd(paidAt, interval);
    providerEnd = new Date(Math.min(Number(sub.current_end) * 1000, invoiceEnd.getTime()));
  } else {
    if (payment.order_id !== checkoutId) throw new ServiceError("Payment is for a different order.", 403);
    const order = await razorpayClient().orders.fetch(checkoutId);
    if (order.notes?.userId !== checkout.userId || order.notes?.planId !== checkout.planId || order.currency !== checkout.currency || Number(order.amount) !== checkout.amount) throw new ServiceError("Order metadata does not match this checkout.", 403);
  }

  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${checkout.userId} FOR UPDATE`;
    const user = await tx.user.findUniqueOrThrow({ where: { id: checkout.userId } });
    const applied = await tx.billingPayment.findUnique({ where: { id: paymentId } });
    if (applied) {
      if (applied.userId !== checkout.userId || applied.checkoutId !== checkoutId) throw new ServiceError("Payment has already been applied elsewhere.", 403);
      return { planId: checkout.planId, paidThrough: applied.paidThrough, newlyApplied: false };
    }
    if (user.razorpaySubscriptionId && user.razorpaySubscriptionId !== checkoutId && user.paidThrough && user.paidThrough > new Date()) throw new ServiceError("A different subscription is already active. Contact support before changing plans.", 409);
    const capturedAt = new Date(Number(payment.created_at) * 1000);
    // An old proof never creates a fresh month at replay time.
    const paidThrough = providerEnd ?? billingPeriodEnd(capturedAt, interval);
    if (user.subscribedAt && user.subscribedAt > capturedAt) return { planId: user.planId, paidThrough: user.paidThrough ?? paidThrough, newlyApplied: false };
    const effectiveEnd = user.planId === checkout.planId && user.paidThrough && user.paidThrough > paidThrough ? user.paidThrough : paidThrough;
    await tx.billingPayment.create({ data: { id: paymentId, userId: checkout.userId, checkoutId, paidThrough } });
    await tx.user.update({ where: { id: checkout.userId }, data: {
      planId: checkout.planId, subscribedAt: capturedAt, paidThrough: effectiveEnd,
      ...(checkout.kind === "subscription" ? { razorpaySubscriptionId: checkoutId } : {}),
    } });
    return { planId: checkout.planId, paidThrough: effectiveEnd, newlyApplied: true };
  });
}
