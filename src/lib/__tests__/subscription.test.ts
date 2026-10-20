import { afterEach, describe, expect, it, vi } from "vitest";
import { calendarDaysUntilTrialEnd, getSubscriptionStatus, isAdminEmail } from "../subscription";

const DAY = 24 * 60 * 60 * 1000;
const NON_ADMIN_EMAIL = "user@example.com";

describe("getSubscriptionStatus", () => {
  it("treats an active trial as trialing, not blocked, unlimited clients", () => {
    const status = getSubscriptionStatus({
      email: NON_ADMIN_EMAIL,
      planId: "trial",
      trialEndsAt: new Date(Date.now() + 3 * DAY),
    });
    expect(status.planId).toBe("trial");
    expect(status.isTrialing).toBe(true);
    expect(status.isSubscribed).toBe(false);
    expect(status.isTrialExpired).toBe(false);
    expect(status.isBlocked).toBe(false);
    expect(status.clientLimit).toBeNull();
    expect(status.isAdminOverride).toBe(false);
  });

  it("uses calendar days for trialDaysLeft (signup yesterday → 6 days left today)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-20T06:05:00.000Z"));
    const trialEndsAt = new Date("2026-10-26T15:00:00.000Z"); // 7 days after Oct 19 signup
    const status = getSubscriptionStatus({ email: NON_ADMIN_EMAIL, planId: "trial", trialEndsAt });
    expect(status.trialDaysLeft).toBe(6);
    vi.useRealTimers();
  });

  it("shows 1 day left on the last calendar day before trialEndsAt", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-26T08:00:00.000Z"));
    const trialEndsAt = new Date("2026-10-26T23:59:00.000Z");
    const status = getSubscriptionStatus({ email: NON_ADMIN_EMAIL, planId: "trial", trialEndsAt });
    expect(status.trialDaysLeft).toBe(1);
    vi.useRealTimers();
  });

  it("calendarDaysUntilTrialEnd ignores time-of-day within the same UTC date", () => {
    const end = new Date("2026-10-26T23:00:00.000Z");
    const morning = new Date("2026-10-20T01:00:00.000Z");
    const evening = new Date("2026-10-20T22:00:00.000Z");
    expect(calendarDaysUntilTrialEnd(end, morning)).toBe(6);
    expect(calendarDaysUntilTrialEnd(end, evening)).toBe(6);
  });

  it("reports 0 days left once the trial has just barely expired", () => {
    const status = getSubscriptionStatus({ email: NON_ADMIN_EMAIL, planId: "trial", trialEndsAt: new Date(Date.now() - 1000) });
    expect(status.trialDaysLeft).toBe(0);
    expect(status.isTrialExpired).toBe(true);
    expect(status.isBlocked).toBe(true);
  });

  it("blocks a trial user once trialEndsAt is in the past", () => {
    const status = getSubscriptionStatus({ email: NON_ADMIN_EMAIL, planId: "trial", trialEndsAt: new Date(Date.now() - 3 * DAY) });
    expect(status.isTrialExpired).toBe(true);
    expect(status.isBlocked).toBe(true);
  });

  it("never blocks a starter subscriber, and caps clients at 10", () => {
    const status = getSubscriptionStatus({ email: NON_ADMIN_EMAIL, planId: "starter", trialEndsAt: new Date(Date.now() - 30 * DAY) });
    expect(status.isSubscribed).toBe(true);
    expect(status.isTrialing).toBe(false);
    expect(status.isBlocked).toBe(false);
    expect(status.clientLimit).toBe(10);
  });

  it("never blocks a professional subscriber, and has no client limit", () => {
    const status = getSubscriptionStatus({
      email: NON_ADMIN_EMAIL,
      planId: "professional",
      trialEndsAt: new Date(Date.now() - 30 * DAY),
    });
    expect(status.isSubscribed).toBe(true);
    expect(status.isBlocked).toBe(false);
    expect(status.clientLimit).toBeNull();
  });

  it("always blocks a cancelled subscription, regardless of trialEndsAt", () => {
    const status = getSubscriptionStatus({ email: NON_ADMIN_EMAIL, planId: "cancelled", trialEndsAt: new Date(Date.now() + 30 * DAY) });
    expect(status.isBlocked).toBe(true);
    expect(status.isSubscribed).toBe(false);
    expect(status.isTrialing).toBe(false);
  });

  it("falls back to trial rules for an unrecognized planId rather than granting free access", () => {
    const status = getSubscriptionStatus({ email: NON_ADMIN_EMAIL, planId: "enterprise", trialEndsAt: new Date(Date.now() + 3 * DAY) });
    expect(status.planId).toBe("trial");
    expect(status.isTrialing).toBe(true);
    expect(status.isBlocked).toBe(false);
  });
});

describe("admin override (ADMIN_EMAILS)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("isAdminEmail matches a listed address case-insensitively", () => {
    vi.stubEnv("ADMIN_EMAILS", "Owner@Example.com, second@example.com");
    expect(isAdminEmail("owner@example.com")).toBe(true);
    expect(isAdminEmail("OWNER@EXAMPLE.COM")).toBe(true);
    expect(isAdminEmail("second@example.com")).toBe(true);
  });

  it("isAdminEmail tolerates surrounding whitespace around each listed address", () => {
    vi.stubEnv("ADMIN_EMAILS", "  owner@example.com  ,second@example.com ");
    expect(isAdminEmail("owner@example.com")).toBe(true);
    expect(isAdminEmail("second@example.com")).toBe(true);
  });

  it("isAdminEmail returns false for an address not on the list, or when the list is unset", () => {
    vi.stubEnv("ADMIN_EMAILS", "owner@example.com");
    expect(isAdminEmail("nobody@example.com")).toBe(false);
    vi.unstubAllEnvs();
    expect(isAdminEmail("owner@example.com")).toBe(false);
  });

  it("isAdminEmail returns false for null/undefined/empty without throwing", () => {
    vi.stubEnv("ADMIN_EMAILS", "owner@example.com");
    expect(isAdminEmail(null)).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
    expect(isAdminEmail("")).toBe(false);
  });

  it("grants full Professional access to an admin email regardless of their real planId/trialEndsAt", () => {
    vi.stubEnv("ADMIN_EMAILS", "owner@example.com");
    const status = getSubscriptionStatus({
      email: "owner@example.com",
      planId: "cancelled", // would otherwise be blocked
      trialEndsAt: new Date(Date.now() - 30 * DAY), // would otherwise read as long-expired
    });
    expect(status.planId).toBe("professional");
    expect(status.isSubscribed).toBe(true);
    expect(status.isTrialing).toBe(false);
    expect(status.isTrialExpired).toBe(false);
    expect(status.isBlocked).toBe(false);
    expect(status.clientLimit).toBeNull();
    expect(status.isAdminOverride).toBe(true);
  });

  it("matches an admin email case-insensitively through getSubscriptionStatus too", () => {
    vi.stubEnv("ADMIN_EMAILS", "owner@example.com");
    const status = getSubscriptionStatus({
      email: "Owner@Example.com",
      planId: "trial",
      trialEndsAt: new Date(Date.now() - DAY),
    });
    expect(status.isAdminOverride).toBe(true);
    expect(status.isBlocked).toBe(false);
  });

  it("does not override a user whose email isn't on the list", () => {
    vi.stubEnv("ADMIN_EMAILS", "owner@example.com");
    const status = getSubscriptionStatus({
      email: NON_ADMIN_EMAIL,
      planId: "cancelled",
      trialEndsAt: new Date(Date.now() - 30 * DAY),
    });
    expect(status.isAdminOverride).toBe(false);
    expect(status.isBlocked).toBe(true);
  });
});
