/**
 * Razorpay integration — server-side only. RAZORPAY_KEY_SECRET must never
 * be imported by, or reachable from, any client component: it's read here
 * (and only here, plus the HMAC checks in api/payments/verify) via
 * process.env, which Next.js does NOT inline into client bundles unless a
 * variable is explicitly prefixed NEXT_PUBLIC_. The publishable
 * NEXT_PUBLIC_RAZORPAY_KEY_ID is the only Razorpay credential the frontend
 * (components/subscribe-button.tsx) ever touches.
 *
 * Billing modes (see docs/billing-subscriptions.md):
 * - **Subscriptions API** (preferred when RAZORPAY_PLAN_* env vars are set):
 *   recurring auto-charge via api/payments/create-subscription + subscription
 *   webhooks; User.razorpayCustomerId / razorpaySubscriptionId populated.
 * - **Orders API** (legacy fallback when plan IDs are unset): one-time
 *   checkout via api/payments/create-order — no automatic renewal.
 */

import Razorpay from "razorpay";
import crypto from "node:crypto";
import type { PricingCurrency } from "@/lib/currency";

export type PlanId = "starter" | "professional";
import type { BillingInterval } from "./plan-pricing";

import { amountForCurrency } from "./plan-pricing";
export { PLANS, amountForCurrency } from "./plan-pricing";
export type { BillingInterval } from "./plan-pricing";

export function isPlanId(value: unknown): value is PlanId {
  return value === "starter" || value === "professional";
}

export function isPricingCurrency(value: unknown): value is PricingCurrency {
  return value === "INR" || value === "USD";
}

export function isBillingInterval(value: unknown): value is BillingInterval {
  return value === "monthly" || value === "annual";
}

/** Reverse of PLANS: which plan (if any) costs exactly this much, in this currency — used by the payments webhook to derive planId from the amount actually captured rather than trusting a client- or notes-supplied planId. */
export function planIdForAmount(amount: number, currency: string): PlanId | null {
  if (!isPricingCurrency(currency)) return null;
  for (const planId of ["starter", "professional"] as const) {
    if (amount === amountForCurrency(planId, currency as PricingCurrency, "monthly")) return planId;
    if (amount === amountForCurrency(planId, currency as PricingCurrency, "annual")) return planId;
  }
  return null;
}

let cachedClient: Razorpay | null = null;

/** Lazily-constructed singleton so importing this module doesn't throw when the two env vars are unset (e.g. in tests) — only calling this does. */
export function razorpayClient(): Razorpay {
  if (cachedClient) return cachedClient;

  // .trim() guards against the single most common cause of Razorpay's API
  // returning 401 "Authentication failed" with valid-looking keys: a
  // trailing newline/space left over from copy-pasting the value into
  // Vercel's env var UI (or a local .env file). A key that's simply wrong
  // still fails auth exactly the same way after trimming — this only
  // rescues an otherwise-correct key that picked up invisible whitespace.
  const key_id = process.env.RAZORPAY_KEY_ID?.trim();
  const key_secret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!key_id || !key_secret) {
    throw new Error("Razorpay is not configured (missing RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET).");
  }

  cachedClient = new Razorpay({ key_id, key_secret });
  return cachedClient;
}

function hmacSha256Hex(data: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(data).digest("hex");
}

/** Constant-time hex-string compare — a plain === on attacker-influenced input invites timing attacks. Mismatched lengths report false rather than throwing (timingSafeEqual throws on a length mismatch, and that IS the "not valid" case both signature checks below want to report as false). */
function timingSafeHexEqual(expectedHex: string, actualHex: string): boolean {
  const expectedBuf = Buffer.from(expectedHex, "utf8");
  const actualBuf = Buffer.from(actualHex, "utf8");
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

/**
 * Verifies a checkout payment against Razorpay's documented signature
 * scheme: HMAC-SHA256 of "{order_id}|{payment_id}" using the account's key
 * secret, which must equal the signature Checkout returned. This is the
 * ONLY thing that marks a payment as real — the frontend reporting
 * "success" is never trusted on its own (see api/payments/verify).
 */
export function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string,
  keySecret: string,
): boolean {
  return timingSafeHexEqual(hmacSha256Hex(`${orderId}|${paymentId}`, keySecret), signature);
}

/** Subscription Checkout signature: HMAC-SHA256 of "{payment_id}|{subscription_id}". */
export function verifySubscriptionPaymentSignature(
  paymentId: string,
  subscriptionId: string,
  signature: string,
  keySecret: string,
): boolean {
  return timingSafeHexEqual(hmacSha256Hex(`${paymentId}|${subscriptionId}`, keySecret), signature);
}

/** Razorpay Dashboard plan id for this product tier — null when not configured (Orders fallback). */
export function getRazorpayPlanId(
  planId: PlanId,
  currency: PricingCurrency,
  interval: BillingInterval,
): string | null {
  const envKey = `RAZORPAY_PLAN_${planId.toUpperCase()}_${currency}_${interval.toUpperCase()}`;
  const value = process.env[envKey]?.trim();
  return value || null;
}

export function isRazorpaySubscriptionsConfigured(): boolean {
  return (["starter", "professional"] as const).some(plan =>
    (["INR", "USD"] as const).some(currency =>
      (["monthly", "annual"] as const).some(interval => getRazorpayPlanId(plan, currency, interval) !== null)));
}

/** Reverse lookup from a Razorpay plan id back to our planId — used by webhooks. */
export function planIdFromRazorpayPlan(razorpayPlanId: string): PlanId | null {
  for (const planId of ["starter", "professional"] as const) {
    for (const currency of ["INR", "USD"] as const) {
      for (const interval of ["monthly", "annual"] as const) {
        if (getRazorpayPlanId(planId, currency, interval) === razorpayPlanId) return planId;
      }
    }
  }
  return null;
}

/** Billing cycles Razorpay requires on subscription create — long enough to run until cancelled. */
export function subscriptionTotalCount(interval: BillingInterval): number {
  return interval === "annual" ? 10 : 120;
}

/**
 * Verifies a Razorpay webhook request against Razorpay's documented
 * webhook signature scheme: HMAC-SHA256 of the exact raw request body
 * (not the parsed/re-serialized JSON — whitespace or key order differences
 * would produce a different digest) using the webhook secret configured
 * in the Razorpay dashboard, compared against the X-Razorpay-Signature
 * header. This is a DIFFERENT secret and scheme from verifyPaymentSignature
 * above: RAZORPAY_WEBHOOK_SECRET, not RAZORPAY_KEY_SECRET, and the raw
 * body, not "{order_id}|{payment_id}".
 */
export function verifyWebhookSignature(rawBody: string, signature: string, webhookSecret: string): boolean {
  return timingSafeHexEqual(hmacSha256Hex(rawBody, webhookSecret), signature);
}
