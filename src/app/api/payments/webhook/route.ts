import { ServiceError } from "@/lib/service-error";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { razorpayClient, verifyWebhookSignature } from "@/lib/razorpay";
import { applyCapturedPayment } from "@/lib/billing-entitlements";
import { apiErrorResponse } from "@/lib/api-error";

/** Authenticate raw bytes, then fetch authoritative provider state. Failures return non-2xx for retry. */
export async function POST(req: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: "Webhooks are not configured" }, { status: 503 });
  const raw = await req.text();
  const signature = req.headers.get("x-razorpay-signature");
  if (!signature || !verifyWebhookSignature(raw, signature, secret)) return NextResponse.json({ error: "Signature mismatch" }, { status: 400 });
  try {
    const body = JSON.parse(raw);
    const paymentId = body.payload?.payment?.entity?.id;
    const subscriptionId = body.payload?.subscription?.entity?.id;
    if ((body.event === "payment.captured" || body.event === "subscription.charged") && typeof paymentId === "string") {
      const payment = await razorpayClient().payments.fetch(paymentId);
      let checkoutId = payment.order_id;
      if (payment.invoice_id) {
        const invoice = await razorpayClient().invoices.fetch(payment.invoice_id) as { subscription_id?: string };
        if (invoice.subscription_id) checkoutId = invoice.subscription_id;
      }
      if (!checkoutId) throw new Error("Captured payment has no resolvable checkout.");
      // Ignore unrelated payments in a shared Razorpay account, but log for reconciliation.
      const checkout = await prisma.billingCheckout.findUnique({ where: { id: checkoutId } });
      if (checkout) await applyCapturedPayment(paymentId, checkoutId);
      else throw new ServiceError("Checkout metadata is not available yet; retry or reconcile this payment.", 503);
    }
    if (["subscription.cancelled", "subscription.completed", "subscription.halted"].includes(body.event) && typeof subscriptionId === "string") {
      const live = await razorpayClient().subscriptions.fetch(subscriptionId);
      if (["cancelled", "completed", "halted"].includes(live.status)) {
        // A cancellation for an older checkout cannot clobber a newer subscription.
        // Keep already paid access until paidThrough; no new renewal is granted here.
        await prisma.user.updateMany({ where: { razorpaySubscriptionId: subscriptionId }, data: { razorpaySubscriptionId: null } });
      }
    }
    // authenticated/activated are not evidence of captured payment and grant no access.
    return NextResponse.json({ received: true });
  } catch (err) {
    return apiErrorResponse(err, "payments:webhook");
  }
}
