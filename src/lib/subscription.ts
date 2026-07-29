/**
 * Single source of truth for what a user's subscription plan allows —
 * every page/route that needs to know "can this user do X" computes it
 * from a fresh User row via getSubscriptionStatus rather than re-deriving
 * the rules inline, so the trial/paywall/limit logic can't drift between
 * call sites.
 *
 * planId is a free-form TEXT column (see prisma/schema.prisma), not a DB
 * enum, so an unrecognized value (e.g. a future plan added without an app
 * deploy, or a hand-edited row) falls back to "trial" rather than crashing
 * or silently granting access.
 *
 * ADMIN_EMAILS (comma-separated, case-insensitive) grants an unconditional
 * full-Professional override to whichever real accounts are listed there —
 * for the product owner to always have full access while testing, without
 * touching the database. It's checked first and short-circuits everything
 * else in getSubscriptionStatus: an admin email always reads as
 * Professional/unblocked/unlimited regardless of what's actually stored in
 * planId/trialEndsAt for that row.
 */

export type PlanId = "trial" | "starter" | "professional" | "cancelled";

function parseAdminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** Case-insensitive membership check against ADMIN_EMAILS — exported so callers outside getSubscriptionStatus (e.g. a future admin-only route) can reuse the exact same rule without re-parsing the env var themselves. */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return parseAdminEmails().has(email.trim().toLowerCase());
}

const KNOWN_PLAN_IDS: readonly PlanId[] = ["trial", "starter", "professional", "cancelled"];

function normalizePlanId(planId: string): PlanId {
  return (KNOWN_PLAN_IDS as readonly string[]).includes(planId) ? (planId as PlanId) : "trial";
}

// Starter caps client accounts at 5; Professional and an active trial are
// unlimited (trial is time-gated instead — see isBlocked). "cancelled"
// has no meaningful limit of its own since isBlocked already blocks the
// actions a limit would otherwise apply to.
const CLIENT_LIMITS: Partial<Record<PlanId, number>> = { starter: 5 };

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface SubscriptionUser {
  email: string;
  planId: string;
  trialEndsAt: Date;
}

export interface SubscriptionStatus {
  planId: PlanId;
  /** starter or professional, currently active (not cancelled). */
  isSubscribed: boolean;
  isTrialing: boolean;
  /** Whole days remaining until trialEndsAt, floored at 0. 0 whenever not trialing. */
  trialDaysLeft: number;
  /** True only while still on the trial plan AND trialEndsAt has passed. */
  isTrialExpired: boolean;
  /** Trial expired-and-unpaid, or a lapsed ("cancelled") subscription — the paywall gate for report generation / adding clients. */
  isBlocked: boolean;
  /** Max client accounts for this plan, or null for unlimited. */
  clientLimit: number | null;
  /** True when this status came from an ADMIN_EMAILS match, not the row's real planId — lets UI (e.g. the billing page) show "full access" instead of pretending a real subscription/trial exists. */
  isAdminOverride: boolean;
}

const ADMIN_OVERRIDE_STATUS: SubscriptionStatus = {
  planId: "professional",
  isSubscribed: true,
  isTrialing: false,
  trialDaysLeft: 0,
  isTrialExpired: false,
  isBlocked: false,
  clientLimit: null,
  isAdminOverride: true,
};

export function getSubscriptionStatus(user: SubscriptionUser): SubscriptionStatus {
  if (isAdminEmail(user.email)) return ADMIN_OVERRIDE_STATUS;

  const planId = normalizePlanId(user.planId);
  const isTrialing = planId === "trial";
  const isSubscribed = planId === "starter" || planId === "professional";

  const msLeft = user.trialEndsAt.getTime() - Date.now();
  const trialDaysLeft = isTrialing ? Math.max(0, Math.ceil(msLeft / MS_PER_DAY)) : 0;
  const isTrialExpired = isTrialing && msLeft <= 0;

  const isBlocked = (isTrialing && isTrialExpired) || planId === "cancelled";
  const clientLimit = CLIENT_LIMITS[planId] ?? null;

  return { planId, isSubscribed, isTrialing, trialDaysLeft, isTrialExpired, isBlocked, clientLimit, isAdminOverride: false };
}
