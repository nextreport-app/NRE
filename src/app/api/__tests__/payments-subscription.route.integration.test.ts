import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { jsonBody, mockSession } from "@/test/api-route-harness";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/razorpay-subscriptions", () => ({
  isRazorpaySubscriptionsConfigured: vi.fn(),
  createRazorpaySubscription: vi.fn(),
}));

import { auth } from "@/lib/auth";
import { createRazorpaySubscription, isRazorpaySubscriptionsConfigured } from "@/lib/razorpay-subscriptions";
import { GET as getConfig } from "../payments/config/route";
import { POST as createSubscription } from "../payments/create-subscription/route";

describe("GET /api/payments/config", () => {
  it("reports whether subscriptions are configured", async () => {
    vi.mocked(isRazorpaySubscriptionsConfigured).mockReturnValue(true);
    const res = await getConfig();
    expect(res.status).toBe(200);
    const body = await jsonBody<{ subscriptionsEnabled: boolean }>(res);
    expect(body.subscriptionsEnabled).toBe(true);
  });
});

describe("POST /api/payments/create-subscription", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    vi.mocked(isRazorpaySubscriptionsConfigured).mockReset();
    vi.mocked(createRazorpaySubscription).mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await createSubscription(
      new Request("http://localhost/api/payments/create-subscription", { method: "POST", body: "{}" }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 503 with useOrders when subscriptions are not configured", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession("user_1"));
    vi.mocked(isRazorpaySubscriptionsConfigured).mockReturnValue(false);

    const res = await createSubscription(
      new Request("http://localhost/api/payments/create-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: "starter", currency: "INR", interval: "monthly" }),
      }),
    );
    expect(res.status).toBe(503);
    const body = await jsonBody<{ useOrders: boolean }>(res);
    expect(body.useOrders).toBe(true);
  });

  it("creates a subscription for authenticated users", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession("user_1", "pay@example.com"));
    vi.mocked(isRazorpaySubscriptionsConfigured).mockReturnValue(true);
    vi.mocked(createRazorpaySubscription).mockResolvedValue({
      subscriptionId: "sub_123",
      planId: "starter",
      interval: "monthly",
      currency: "INR",
    });

    const res = await createSubscription(
      new Request("http://localhost/api/payments/create-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: "starter", currency: "INR", interval: "monthly" }),
      }),
    );
    expect(res.status).toBe(200);
    const body = await jsonBody<{ mode: string; subscription_id: string }>(res);
    expect(body.mode).toBe("subscription");
    expect(body.subscription_id).toBe("sub_123");
  });
});
