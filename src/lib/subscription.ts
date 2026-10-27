import { AGENCY_CLIENT_LIMIT, PROFESSIONAL_CLIENT_LIMIT, TRIAL_CLIENT_LIMIT } from "./launch-limits";
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

// Launch limits apply to active client rows, with the trial additionally time-gated. "cancelled"
// has no meaningful limit of its own since isBlocked already blocks the
// actions a limit would otherwise apply to.
const CLIENT_LIMITS: Partial<Record<PlanId, number>> = { starter: AGENCY_CLIENT_LIMIT, professional: PROFESSIONAL_CLIENT_LIMIT, trial: TRIAL_CLIENT_LIMIT };

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** UTC calendar-day gap from `now` until `trialEndsAt` (matches “signed up yesterday → 6 days left today”). */
export function calendarDaysUntilTrialEnd(trialEndsAt: Date, now: Date = new Date()): number {
  const endDay = Date.UTC(trialEndsAt.getUTCFullYear(), trialEndsAt.getUTCMonth(), trialEndsAt.getUTCDate());
  const nowDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.max(0, Math.floor((endDay - nowDay) / MS_PER_DAY));
}

export interface SubscriptionUser {
  email: string;
  planId: string;
  trialEndsAt: Date;
  paidThrough?: Date | null;
  emailVerified?: Date | null;
}

export interface SubscriptionStatus {
  planId: PlanId;
  /** starter or professional, currently active (not cancelled). */
  isSubscribed: boolean;
  isTrialing: boolean;
  /** Whole calendar days until trialEndsAt (UTC dates); 1 on the last day while still active. 0 when not trialing or expired. */
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
  if (isAdminEmail(user.email) && user.emailVerified) return ADMIN_OVERRIDE_STATUS;

  const planId = normalizePlanId(user.planId);
  const isTrialing = planId === "trial";
  const paidPlan = planId === "starter" || planId === "professional";
  const isSubscribed = paidPlan && !!user.paidThrough && user.paidThrough.getTime() > Date.now();

  const now = new Date();
  const msLeft = user.trialEndsAt.getTime() - now.getTime();
  let trialDaysLeft = 0;
  if (isTrialing && msLeft > 0) {
    trialDaysLeft = calendarDaysUntilTrialEnd(user.trialEndsAt, now);
    // Last calendar day before trialEndsAt instant — still reads as “1 day”, not “0 days”.
    if (trialDaysLeft === 0) trialDaysLeft = 1;
  }
  const isTrialExpired = isTrialing && msLeft <= 0;

  const isBlocked = (isTrialing && isTrialExpired) || planId === "cancelled" || (paidPlan && !isSubscribed);
  const clientLimit = CLIENT_LIMITS[planId] ?? null;

  return { planId, isSubscribed, isTrialing, trialDaysLeft, isTrialExpired, isBlocked, clientLimit, isAdminOverride: false };
}
