import crypto from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isPlanId, PLANS, planIdForAmount, razorpayClient, verifyPaymentSignature, verifyWebhookSignature } from "../razorpay";

describe("PLANS", () => {
  it("prices Starter at ₹999/month in paise", () => {
    expect(PLANS.starter.amountPaise).toBe(99_900);
  });

  it("prices Professional at ₹2,499/month in paise", () => {
    expect(PLANS.professional.amountPaise).toBe(249_900);
  });
});

describe("isPlanId", () => {
  it("accepts starter and professional", () => {
    expect(isPlanId("starter")).toBe(true);
    expect(isPlanId("professional")).toBe(true);
  });

  it("rejects anything else, including a trial/cancelled planId or garbage input", () => {
    expect(isPlanId("trial")).toBe(false);
    expect(isPlanId("cancelled")).toBe(false);
    expect(isPlanId("")).toBe(false);
    expect(isPlanId(undefined)).toBe(false);
    expect(isPlanId(42)).toBe(false);
  });
});

describe("verifyPaymentSignature", () => {
  const secret = "test-key-secret";
  const orderId = "order_ABC123";
  const paymentId = "pay_XYZ789";

  function sign(orderId: string, paymentId: string, secret: string): string {
    return crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  }

  it("accepts a signature computed the same way Razorpay computes it", () => {
    const signature = sign(orderId, paymentId, secret);
    expect(verifyPaymentSignature(orderId, paymentId, signature, secret)).toBe(true);
  });

  it("rejects a signature for the wrong order/payment id pair", () => {
    const signature = sign(orderId, paymentId, secret);
    expect(verifyPaymentSignature("order_OTHER", paymentId, signature, secret)).toBe(false);
    expect(verifyPaymentSignature(orderId, "pay_OTHER", signature, secret)).toBe(false);
  });

  it("rejects a signature signed with the wrong secret (forged by an attacker who doesn't have it)", () => {
    const signature = sign(orderId, paymentId, "wrong-secret");
    expect(verifyPaymentSignature(orderId, paymentId, signature, secret)).toBe(false);
  });

  it("rejects a tampered signature of a different length without throwing", () => {
    expect(verifyPaymentSignature(orderId, paymentId, "short", secret)).toBe(false);
  });

  it("rejects an empty signature", () => {
    expect(verifyPaymentSignature(orderId, paymentId, "", secret)).toBe(false);
  });
});

describe("verifyWebhookSignature", () => {
  const secret = "test-webhook-secret";
  const rawBody = '{"event":"payment.captured","payload":{"payment":{"entity":{"id":"pay_ABC123"}}}}';

  function sign(body: string, secret: string): string {
    return crypto.createHmac("sha256", secret).update(body).digest("hex");
  }

  it("accepts a signature computed over the exact raw body, the same way Razorpay computes it", () => {
    const signature = sign(rawBody, secret);
    expect(verifyWebhookSignature(rawBody, signature, secret)).toBe(true);
  });

  it("rejects a signature if even whitespace in the body differs from what was signed", () => {
    const signature = sign(rawBody, secret);
    const reformatted = JSON.stringify(JSON.parse(rawBody), null, 2);
    expect(verifyWebhookSignature(reformatted, signature, secret)).toBe(false);
  });

  it("rejects a signature signed with the wrong webhook secret", () => {
    const signature = sign(rawBody, "wrong-secret");
    expect(verifyWebhookSignature(rawBody, signature, secret)).toBe(false);
  });

  it("rejects a tampered signature of a different length without throwing", () => {
    expect(verifyWebhookSignature(rawBody, "short", secret)).toBe(false);
  });

  it("uses a different, non-interchangeable scheme from verifyPaymentSignature (order|payment vs. raw body)", () => {
    // Confirms the two functions aren't accidentally aliases of each other:
    // a checkout signature for this body's payment/order pair must not
    // also validate as a webhook signature over the raw body, even with
    // the same secret.
    const checkoutSignature = crypto.createHmac("sha256", secret).update("order_X|pay_ABC123").digest("hex");
    expect(verifyWebhookSignature(rawBody, checkoutSignature, secret)).toBe(false);
  });
});

describe("planIdForAmount", () => {
  it("maps ₹999 in paise, INR, to starter", () => {
    expect(planIdForAmount(99_900, "INR")).toBe("starter");
  });

  it("maps ₹2,499 in paise, INR, to professional", () => {
    expect(planIdForAmount(249_900, "INR")).toBe("professional");
  });

  it("returns null for an amount that doesn't match either plan exactly", () => {
    expect(planIdForAmount(50_000, "INR")).toBeNull();
    expect(planIdForAmount(99_901, "INR")).toBeNull();
  });

  it("returns null for a non-INR currency even if the amount matches a plan price numerically", () => {
    expect(planIdForAmount(99_900, "USD")).toBeNull();
  });
});

describe("razorpayClient", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("throws a clear, actionable error when either env var is missing", () => {
    vi.stubEnv("RAZORPAY_KEY_ID", "");
    vi.stubEnv("RAZORPAY_KEY_SECRET", "");
    expect(() => razorpayClient()).toThrow(/RAZORPAY_KEY_ID.*RAZORPAY_KEY_SECRET/);
  });

  // Regression test for a real reported bug: Razorpay's API rejects a
  // key_id/key_secret pair with 401 "Authentication failed" if either
  // value has a trailing newline or space — the single most common way
  // that happens is copy-pasting the value into Vercel's env var UI (or a
  // local .env file) and picking up a stray newline along with it. The
  // key itself is otherwise completely correct; only the invisible
  // whitespace makes Razorpay reject it.
  it("trims a trailing newline/space from both key_id and key_secret before constructing the client", () => {
    vi.stubEnv("RAZORPAY_KEY_ID", "rzp_test_ABC123\n");
    vi.stubEnv("RAZORPAY_KEY_SECRET", "  supersecretvalue \n");
    const client = razorpayClient() as unknown as { key_id: string; key_secret: string };
    expect(client.key_id).toBe("rzp_test_ABC123");
    expect(client.key_secret).toBe("supersecretvalue");
  });
});
