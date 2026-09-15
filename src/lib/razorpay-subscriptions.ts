/**
 * Razorpay Subscriptions API helpers — customer + subscription lifecycle.
 * See docs/billing-subscriptions.md for Dashboard plan setup.
 */

import { prisma } from "@/lib/prisma";
import {
  getRazorpayPlanId,
  isRazorpaySubscriptionsConfigured,
  razorpayClient,
  subscriptionTotalCount,
  type BillingInterval,
  type PlanId,
} from "@/lib/razorpay";
import type { PricingCurrency } from "@/lib/currency";

export { isRazorpaySubscriptionsConfigured };

export async function ensureRazorpayCustomer(params: {
  userId: string;
  email: string;
  name?: string | null;
}): Promise<string> {
  const existing = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { razorpayCustomerId: true },
  });
  if (existing?.razorpayCustomerId) return existing.razorpayCustomerId;

  const customer = await razorpayClient().customers.create({
    name: params.name?.trim() || params.email,
    email: params.email,
  });

  await prisma.user.update({
    where: { id: params.userId },
    data: { razorpayCustomerId: customer.id },
  });

  return customer.id;
}

export async function createRazorpaySubscription(params: {
  userId: string;
  email: string;
  name?: string | null;
  planId: PlanId;
  currency: PricingCurrency;
  interval: BillingInterval;
}): Promise<{ subscriptionId: string; planId: PlanId; interval: BillingInterval; currency: PricingCurrency }> {
  const razorpayPlanId = getRazorpayPlanId(params.planId, params.currency, params.interval);
  if (!razorpayPlanId) {
    throw new Error("Razorpay subscription plans are not configured for this plan and currency.");
  }

  const customerId = await ensureRazorpayCustomer({
    userId: params.userId,
    email: params.email,
    name: params.name,
  });

  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { razorpaySubscriptionId: true },
  });

  // Upgrade/downgrade: cancel any existing Razorpay subscription before creating a new one.
  if (user?.razorpaySubscriptionId) {
    try {
      await razorpayClient().subscriptions.cancel(user.razorpaySubscriptionId, false);
    } catch (err) {
      console.warn(
        `[razorpay-subscriptions] could not cancel prior subscription ${user.razorpaySubscriptionId}:`,
        err,
      );
    }
  }

  // ensureRazorpayCustomer persists razorpayCustomerId on User; notes carry
  // customerId for webhook resolution (SDK create types omit customer_id).
  const subscription = await razorpayClient().subscriptions.create({
    plan_id: razorpayPlanId,
    total_count: subscriptionTotalCount(params.interval),
    customer_notify: 1,
    notes: {
      userId: params.userId,
      planId: params.planId,
      currency: params.currency,
      interval: params.interval,
      customerId,
    },
  });

  await prisma.user.update({
    where: { id: params.userId },
    data: { razorpaySubscriptionId: subscription.id },
  });

  return {
    subscriptionId: subscription.id,
    planId: params.planId,
    interval: params.interval,
    currency: params.currency,
  };
}

export async function cancelRazorpaySubscription(subscriptionId: string, cancelAtCycleEnd = false): Promise<void> {
  await razorpayClient().subscriptions.cancel(subscriptionId, cancelAtCycleEnd);
}
