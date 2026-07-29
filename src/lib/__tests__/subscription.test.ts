import { describe, expect, it } from "vitest";
import { getSubscriptionStatus } from "../subscription";

const DAY = 24 * 60 * 60 * 1000;

describe("getSubscriptionStatus", () => {
  it("treats an active trial as trialing, not blocked, unlimited clients", () => {
    const status = getSubscriptionStatus({ planId: "trial", trialEndsAt: new Date(Date.now() + 3 * DAY) });
    expect(status.planId).toBe("trial");
    expect(status.isTrialing).toBe(true);
    expect(status.isSubscribed).toBe(false);
    expect(status.isTrialExpired).toBe(false);
    expect(status.isBlocked).toBe(false);
    expect(status.clientLimit).toBeNull();
  });

  it("rounds trialDaysLeft up so '6 days and 2 hours left' still reads as 7, not 6", () => {
    const status = getSubscriptionStatus({ planId: "trial", trialEndsAt: new Date(Date.now() + 6 * DAY + 2 * 60 * 60 * 1000) });
    expect(status.trialDaysLeft).toBe(7);
  });

  it("reports 0 days left once the trial has just barely expired", () => {
    const status = getSubscriptionStatus({ planId: "trial", trialEndsAt: new Date(Date.now() - 1000) });
    expect(status.trialDaysLeft).toBe(0);
    expect(status.isTrialExpired).toBe(true);
    expect(status.isBlocked).toBe(true);
  });

  it("blocks a trial user once trialEndsAt is in the past", () => {
    const status = getSubscriptionStatus({ planId: "trial", trialEndsAt: new Date(Date.now() - 3 * DAY) });
    expect(status.isTrialExpired).toBe(true);
    expect(status.isBlocked).toBe(true);
  });

  it("never blocks a starter subscriber, and caps clients at 5", () => {
    const status = getSubscriptionStatus({ planId: "starter", trialEndsAt: new Date(Date.now() - 30 * DAY) });
    expect(status.isSubscribed).toBe(true);
    expect(status.isTrialing).toBe(false);
    expect(status.isBlocked).toBe(false);
    expect(status.clientLimit).toBe(5);
  });

  it("never blocks a professional subscriber, and has no client limit", () => {
    const status = getSubscriptionStatus({ planId: "professional", trialEndsAt: new Date(Date.now() - 30 * DAY) });
    expect(status.isSubscribed).toBe(true);
    expect(status.isBlocked).toBe(false);
    expect(status.clientLimit).toBeNull();
  });

  it("always blocks a cancelled subscription, regardless of trialEndsAt", () => {
    const status = getSubscriptionStatus({ planId: "cancelled", trialEndsAt: new Date(Date.now() + 30 * DAY) });
    expect(status.isBlocked).toBe(true);
    expect(status.isSubscribed).toBe(false);
    expect(status.isTrialing).toBe(false);
  });

  it("falls back to trial rules for an unrecognized planId rather than granting free access", () => {
    const status = getSubscriptionStatus({ planId: "enterprise", trialEndsAt: new Date(Date.now() + 3 * DAY) });
    expect(status.planId).toBe("trial");
    expect(status.isTrialing).toBe(true);
    expect(status.isBlocked).toBe(false);
  });
});
