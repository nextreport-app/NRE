/**
 * Razorpay integration — server-side only. RAZORPAY_KEY_SECRET must never
 * be imported by, or reachable from, any client component: it's read here
 * (and only here, plus the HMAC check in api/payments/verify) via
 * process.env, which Next.js does NOT inline into client bundles unless a
 * variable is explicitly prefixed NEXT_PUBLIC_. The publishable
 * NEXT_PUBLIC_RAZORPAY_KEY_ID is the only Razorpay credential the frontend
 * (components/subscribe-button.tsx) ever touches.
 *
 * This integrates Razorpay's one-time Orders API (create an order, collect
 * payment via Checkout, verify the signature) rather than its separate
 * Subscriptions API — that's what api/payments/create-order + verify
 * implement, matching the exact integration spec this was built from.
 * There is therefore no server-side recurring auto-charge: a "subscribed"
 * user's access doesn't automatically renew or re-charge after 30 days,
 * and User.razorpaySubscriptionId is unused today (reserved for if/when
 * real recurring billing via the Subscriptions API + webhooks is added).
 */

import Razorpay from "razorpay";
import crypto from "node:crypto";
import type { PricingCurrency } from "@/lib/currency";

export type PlanId = "starter" | "professional";

export interface PlanDefinition {
  name: string;
  /** INR price, in paise (Razorpay's smallest INR unit). */
  amountPaise: number;
  /** USD price, in cents (Razorpay's smallest USD unit) — Razorpay's international-card support bills USD orders directly, no FX conversion from the INR price. */
  amountUsdCents: number;
}

// ₹999 / $12 per month (Starter) and ₹2,499 / $29 per month (Professional) —
// matches the /pricing page's displayed prices exactly in both currencies.
// Keeping the amount here (not trusted from the client) is what stops a
// tampered frontend request from creating an order for less than the real
// price, in either currency.
export const PLANS: Record<PlanId, PlanDefinition> = {
  starter: { name: "Starter", amountPaise: 99_900, amountUsdCents: 1_200 },
  professional: { name: "Professional", amountPaise: 249_900, amountUsdCents: 2_900 },
};

export function isPlanId(value: unknown): value is PlanId {
  return value === "starter" || value === "professional";
}

export function isPricingCurrency(value: unknown): value is PricingCurrency {
  return value === "INR" || value === "USD";
}

/** The real, server-trusted charge amount for a plan in a given currency — see PLANS' file header for why the client never gets to supply this. */
export function amountForCurrency(planId: PlanId, currency: PricingCurrency): number {
  return currency === "INR" ? PLANS[planId].amountPaise : PLANS[planId].amountUsdCents;
}

/** Reverse of PLANS: which plan (if any) costs exactly this much, in this currency — used by the payments webhook to derive planId from the amount actually captured rather than trusting a client- or notes-supplied planId. */
export function planIdForAmount(amount: number, currency: string): PlanId | null {
  if (currency === "INR") {
    if (amount === PLANS.starter.amountPaise) return "starter";
    if (amount === PLANS.professional.amountPaise) return "professional";
    return null;
  }
  if (currency === "USD") {
    if (amount === PLANS.starter.amountUsdCents) return "starter";
    if (amount === PLANS.professional.amountUsdCents) return "professional";
    return null;
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
