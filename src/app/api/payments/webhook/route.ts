import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { planIdForAmount, razorpayClient, verifyWebhookSignature } from "@/lib/razorpay";

/**
 * Razorpay webhook receiver — configured in the Razorpay dashboard
 * (Settings → Webhooks) pointed at this URL, separately from the Checkout
 * flow in api/payments/create-order + verify. Two independent ways a
 * payment can mark a user subscribed: the browser-side Checkout handler
 * calling /verify right after payment (fast path, but only fires if the
 * user's browser stays online through the redirect), and this webhook
 * (authoritative path — Razorpay calls it server-to-server regardless of
 * what happens in the browser, so it's what actually needs to be correct
 * if the two ever disagree).
 *
 * Every request is verified against RAZORPAY_WEBHOOK_SECRET — a DIFFERENT
 * secret from RAZORPAY_KEY_SECRET, generated separately in the dashboard
 * when the webhook is configured — using Razorpay's webhook signature
 * scheme (HMAC-SHA256 of the raw request body, see
 * lib/razorpay.ts's verifyWebhookSignature). An unverified or malformed
 * request is rejected before any payload field is trusted.
 */

interface WebhookPaymentEntity {
  id: string;
  order_id?: string | null;
  amount: number;
  currency: string;
  customer_id?: string | null;
  notes?: Record<string, string> | null;
  error_code?: string | null;
  error_description?: string | null;
}

interface RazorpayWebhookBody {
  event: string;
  payload?: {
    payment?: { entity?: WebhookPaymentEntity };
  };
}

/**
 * "find the user by razorpayCustomerId or order metadata" — tried in that
 * order:
 *  1. payment.customer_id against User.razorpayCustomerId (currently
 *     never populated by this app's create-order/verify flow — see
 *     lib/razorpay.ts's file header — so this is forward-compatible
 *     groundwork more than an active path today, but cheap to check
 *     first in case it's ever populated by a future Customers API
 *     integration or set by hand).
 *  2. payment.notes.userId — Razorpay copies an order's notes onto the
 *     payment made against it, and api/payments/create-order always sets
 *     notes: { userId, planId } on every order it creates.
 *  3. Fetching the order itself (payment.order_id) and reading ITS notes
 *     directly, in case a payment ever arrives without notes copied
 *     (e.g. a payment created outside this app's own order flow).
 */
async function resolveUserId(payment: WebhookPaymentEntity): Promise<string | null> {
  if (payment.customer_id) {
    const user = await prisma.user.findFirst({
      where: { razorpayCustomerId: payment.customer_id },
      select: { id: true },
    });
    if (user) return user.id;
  }

  const notesUserId = payment.notes?.userId;
  if (notesUserId) return notesUserId;

  if (payment.order_id) {
    try {
      const order = await razorpayClient().orders.fetch(payment.order_id);
      const orderUserId = (order.notes as Record<string, string> | undefined)?.userId;
      if (orderUserId) return orderUserId;
    } catch (err) {
      console.error(`[webhook:payments] could not fetch order ${payment.order_id} to resolve its user:`, err);
    }
  }

  return null;
}

async function handlePaymentCaptured(payment: WebhookPaymentEntity): Promise<void> {
  // planId comes from the amount actually captured, not from
  // payment.notes.planId — the amount is what Razorpay itself charged the
  // card, the authoritative fact this webhook exists to report.
  const planId = planIdForAmount(Number(payment.amount), payment.currency);
  if (!planId) {
    console.error(
      `[webhook:payments] payment.captured ${payment.id}: ${payment.amount} ${payment.currency} doesn't match ` +
        "either plan's price — not changing any subscription",
    );
    return;
  }

  const userId = await resolveUserId(payment);
  if (!userId) {
    console.error(
      `[webhook:payments] payment.captured ${payment.id}: could not resolve a user (no razorpayCustomerId match, ` +
        "no userId in order notes) — not changing any subscription",
    );
    return;
  }

  try {
    await prisma.user.update({ where: { id: userId }, data: { planId, subscribedAt: new Date() } });
    console.log(`[webhook:payments] payment.captured ${payment.id}: set user ${userId} to plan "${planId}"`);
  } catch (err) {
    console.error(`[webhook:payments] payment.captured ${payment.id}: failed to update user ${userId}:`, err);
  }
}

function handlePaymentFailed(payment: WebhookPaymentEntity): void {
  // Logged only — a failed payment never changes planId/subscribedAt.
  // A user who was already subscribed keeps their access; a trial/
  // paywalled user who tried and failed to pay stays exactly as blocked
  // as they were, and can simply retry from /billing or /pricing.
  console.warn(
    `[webhook:payments] payment.failed: payment=${payment.id} order=${payment.order_id ?? "-"} ` +
      `error_code=${payment.error_code ?? "-"} error_description=${payment.error_description ?? "-"}`,
  );
}

export async function POST(req: Request) {
  // .trim() for the same reason as lib/razorpay.ts's razorpayClient() —
  // guards against a trailing newline/space from copy-pasting the secret.
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  if (!secret) {
    console.error("[webhook:payments] RAZORPAY_WEBHOOK_SECRET is not configured — rejecting webhook");
    return NextResponse.json({ error: "Webhooks are not configured" }, { status: 500 });
  }

  const signature = req.headers.get("x-razorpay-signature");
  // The signature is computed over the exact raw bytes Razorpay sent —
  // req.json() would parse-and-discard that original serialization, so
  // the body is read as text first and parsed only after verification.
  const rawBody = await req.text();

  if (!signature || !verifyWebhookSignature(rawBody, signature, secret)) {
    console.error("[webhook:payments] signature verification failed — rejecting webhook");
    return NextResponse.json({ error: "Signature mismatch" }, { status: 400 });
  }

  let body: RazorpayWebhookBody;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const payment = body.payload?.payment?.entity;

  switch (body.event) {
    case "payment.captured":
      if (payment) await handlePaymentCaptured(payment);
      break;
    case "payment.failed":
      if (payment) handlePaymentFailed(payment);
      break;
    default:
      // Any other event type this endpoint doesn't act on yet (order.paid,
      // refund.*, etc.) — acknowledged so Razorpay doesn't keep retrying a
      // webhook there was never going to be a handler for.
      console.log(`[webhook:payments] received unhandled event "${body.event}" — acknowledging, no action taken`);
  }

  // Once the signature verifies, always 200: Razorpay retries on any
  // non-2xx response, and a data-resolution problem above (unmatched
  // amount, unresolvable user) is logged for manual follow-up rather than
  // something a retry of the identical request could ever fix.
  return NextResponse.json({ received: true });
}
