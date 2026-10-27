/** Provider checkout creation never cancels or replaces an existing paid subscription. */
import { prisma } from "./prisma";
import { amountForCurrency, getRazorpayPlanId, isRazorpaySubscriptionsConfigured, razorpayClient, subscriptionTotalCount, type BillingInterval, type PlanId } from "./razorpay";
import type { PricingCurrency } from "./currency";
import { ServiceError } from "./service-error";
export { isRazorpaySubscriptionsConfigured };

export async function createRazorpaySubscription(params: { userId: string; email: string; name?: string | null; planId: PlanId; currency: PricingCurrency; interval: BillingInterval }) {
  const plan = getRazorpayPlanId(params.planId, params.currency, params.interval);
  if (!plan) throw new ServiceError("Recurring billing is not configured for this plan, currency and interval.", 503);
  const remotePlan = await razorpayClient().plans.fetch(plan);
  const amount = amountForCurrency(params.planId, params.currency, params.interval);
  if (Number(remotePlan.item.amount) !== amount || remotePlan.item.currency !== params.currency || remotePlan.interval !== 1 || remotePlan.period !== (params.interval === "annual" ? "yearly" : "monthly")) {
    throw new ServiceError("The payment provider plan does not match the displayed price. Contact support.", 503);
  }
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${params.userId} FOR UPDATE`;
    const user = await tx.user.findUniqueOrThrow({ where: { id: params.userId } });
    if (user.paidThrough && user.paidThrough > new Date()) throw new ServiceError("You already have paid access. Contact support to change plans without duplicate charges.", 409);
    const pending = await tx.billingCheckout.findFirst({ where: { userId: params.userId }, orderBy: { createdAt: "desc" } });
    if (pending?.kind === "order" && !(await tx.billingPayment.findFirst({ where: { checkoutId: pending.id } }))) throw new ServiceError("A one-time checkout is already open. Contact support before changing checkout type.", 409);
    if (pending?.kind === "subscription") {
      const remote = await razorpayClient().subscriptions.fetch(pending.id);
      if (["created", "authenticated", "active", "pending"].includes(remote.status)) {
        if (pending.planId !== params.planId || pending.currency !== params.currency || pending.interval !== params.interval || pending.amount !== amount || remote.plan_id !== plan) throw new ServiceError("A checkout is already open for another plan. Contact support before starting another subscription.", 409);
        return { subscriptionId: pending.id, planId: params.planId, interval: params.interval, currency: params.currency };
      }
    }
    let customerId = user.razorpayCustomerId;
    if (!customerId) {
      const customer = await razorpayClient().customers.create({ name: params.name?.trim() || params.email, email: params.email });
      customerId = customer.id;
      await tx.user.update({ where: { id: user.id }, data: { razorpayCustomerId: customerId } });
    }
    const subscription = await razorpayClient().subscriptions.create({
      plan_id: plan, expire_by: Math.floor(Date.now() / 1000) + 86400, total_count: subscriptionTotalCount(params.interval), customer_notify: 1,
      notes: { userId: user.id, planId: params.planId, currency: params.currency, interval: params.interval, customerId },
    });
    await tx.billingCheckout.create({ data: { id: subscription.id, userId: user.id, kind: "subscription", planId: params.planId, currency: params.currency, interval: params.interval, amount } });
    return { subscriptionId: subscription.id, planId: params.planId, interval: params.interval, currency: params.currency };
  }, { timeout: 20000 });
}

export async function cancelRazorpaySubscription(subscriptionId: string, cancelAtCycleEnd = true): Promise<void> {
  await razorpayClient().subscriptions.cancel(subscriptionId, cancelAtCycleEnd);
}
