import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { isPlanId, PLANS, verifyPaymentSignature } from "../razorpay";

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
