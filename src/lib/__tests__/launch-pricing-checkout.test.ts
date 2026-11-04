import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  tx: {
    $queryRaw: vi.fn(),
    user: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
    billingCheckout: { findFirst: vi.fn(), create: vi.fn() },
  },
  provider: {
    plans: { fetch: vi.fn() },
    subscriptions: { create: vi.fn(), fetch: vi.fn() },
    customers: { create: vi.fn() },
  },
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: (fn: (tx: typeof mocks.tx) => unknown) => fn(mocks.tx),
  },
}));
vi.mock("@/lib/razorpay", async (original) => ({
  ...(await original<typeof import("../razorpay")>()),
  razorpayClient: () => mocks.provider,
}));
import { createRazorpaySubscription } from "../razorpay-subscriptions";
import { amountForCurrency } from "../plan-pricing";

const cases = (["starter", "professional", "agency_plus"] as const).flatMap(
  (planId) =>
    (["INR", "USD"] as const).flatMap((currency) =>
      (["monthly", "annual"] as const).map((interval) => ({
        planId,
        currency,
        interval,
      })),
    ),
);

describe("launch subscription checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tx.user.findUniqueOrThrow.mockResolvedValue({
      id: "user_1",
      paidThrough: null,
      razorpayCustomerId: "cus_1",
    });
    mocks.tx.billingCheckout.findFirst.mockResolvedValue(null);
    mocks.provider.subscriptions.create.mockResolvedValue({ id: "sub_1" });
  });
  afterEach(() => vi.unstubAllEnvs());
  it.each(cases)(
    "checks provider price and records $planId $currency $interval",
    async ({ planId, currency, interval }) => {
      vi.stubEnv(
        `RAZORPAY_PLAN_${planId.toUpperCase()}_${currency}_${interval.toUpperCase()}`,
        "plan_new",
      );
      const amount = amountForCurrency(planId, currency, interval);
      mocks.provider.plans.fetch.mockResolvedValue({
        item: { amount, currency },
        period: interval === "annual" ? "yearly" : "monthly",
        interval: 1,
      });
      await expect(
        createRazorpaySubscription({
          userId: "user_1",
          email: "owner@example.test",
          planId,
          currency,
          interval,
        }),
      ).resolves.toMatchObject({ planId, currency, interval });
      expect(mocks.provider.subscriptions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          plan_id: "plan_new",
          notes: expect.objectContaining({ planId, currency, interval }),
        }),
      );
      expect(mocks.tx.billingCheckout.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ planId, currency, interval, amount }),
      });
    },
  );
  it.each([
    { item: { amount: 2000, currency: "INR" }, period: "monthly", interval: 1 },
    { item: { amount: 2000, currency: "USD" }, period: "yearly", interval: 1 },
    { item: { amount: 2000, currency: "USD" }, period: "monthly", interval: 2 },
  ])("rejects wrong provider currency/period/interval", async remotePlan => {
    vi.stubEnv("RAZORPAY_PLAN_AGENCY_PLUS_USD_MONTHLY", "plan_plus");
    mocks.provider.plans.fetch.mockResolvedValue(remotePlan);
    await expect(createRazorpaySubscription({ userId: "user_1", email: "owner@example.test", planId: "agency_plus", currency: "USD", interval: "monthly" })).rejects.toThrow(/does not match/);
    expect(mocks.provider.subscriptions.create).not.toHaveBeenCalled();
  });
  it("rejects an old provider price before creating a subscription", async () => {
    vi.stubEnv("RAZORPAY_PLAN_STARTER_USD_MONTHLY", "plan_old");
    mocks.provider.plans.fetch.mockResolvedValue({
      item: { amount: 900, currency: "USD" },
      period: "monthly",
      interval: 1,
    });
    await expect(
      createRazorpaySubscription({
        userId: "user_1",
        email: "owner@example.test",
        planId: "starter",
        currency: "USD",
        interval: "monthly",
      }),
    ).rejects.toThrow(/does not match/);
    expect(mocks.provider.subscriptions.create).not.toHaveBeenCalled();
  });
});
