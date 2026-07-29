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

export type PlanId = "starter" | "professional";

export interface PlanDefinition {
  name: string;
  amountPaise: number;
}

// ₹999/month and ₹2,499/month, in paise (Razorpay's smallest INR unit) —
// matches the /pricing page's displayed prices exactly. Keeping the amount
// here (not trusted from the client) is what stops a tampered frontend
// request from creating an order for less than the real price.
export const PLANS: Record<PlanId, PlanDefinition> = {
  starter: { name: "Starter", amountPaise: 99_900 },
  professional: { name: "Professional", amountPaise: 249_900 },
};

export function isPlanId(value: unknown): value is PlanId {
  return value === "starter" || value === "professional";
}

let cachedClient: Razorpay | null = null;

/** Lazily-constructed singleton so importing this module doesn't throw when the two env vars are unset (e.g. in tests) — only calling this does. */
export function razorpayClient(): Razorpay {
  if (cachedClient) return cachedClient;

  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    throw new Error("Razorpay is not configured (missing RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET).");
  }

  cachedClient = new Razorpay({ key_id, key_secret });
  return cachedClient;
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
  const expected = crypto.createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest("hex");

  const expectedBuf = Buffer.from(expected, "utf8");
  const actualBuf = Buffer.from(signature, "utf8");
  // Lengths must match before timingSafeEqual — it throws on a length
  // mismatch rather than returning false, and a mismatched length here is
  // exactly the "not a valid signature" case we want to report as false.
  if (expectedBuf.length !== actualBuf.length) return false;

  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}
