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
 */

export type PlanId = "trial" | "starter" | "professional" | "cancelled";

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
}

export function getSubscriptionStatus(user: SubscriptionUser): SubscriptionStatus {
  const planId = normalizePlanId(user.planId);
  const isTrialing = planId === "trial";
  const isSubscribed = planId === "starter" || planId === "professional";

  const msLeft = user.trialEndsAt.getTime() - Date.now();
  const trialDaysLeft = isTrialing ? Math.max(0, Math.ceil(msLeft / MS_PER_DAY)) : 0;
  const isTrialExpired = isTrialing && msLeft <= 0;

  const isBlocked = (isTrialing && isTrialExpired) || planId === "cancelled";
  const clientLimit = CLIENT_LIMITS[planId] ?? null;

  return { planId, isSubscribed, isTrialing, trialDaysLeft, isTrialExpired, isBlocked, clientLimit };
}
