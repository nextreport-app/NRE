/**
 * Human-readable plan names for UI and checkout.
 * Internal planId values (`starter`, `professional`) stay unchanged for billing/subscription.
 */
export const PLAN_DISPLAY_NAMES = {
  trial: "Free Trial",
  starter: "Freelancer",
  professional: "Agency",
  agency_plus: "Agency Plus",
  cancelled: "Cancelled",
} as const;

export type BillablePlanId = "starter" | "professional" | "agency_plus";

export function getPlanDisplayName(planId: string): string {
  return PLAN_DISPLAY_NAMES[planId as keyof typeof PLAN_DISPLAY_NAMES] ?? planId;
}

/** Short platform list for marketing headlines and feature bullets. */
export const PLATFORM_LIST_SHORT =
  "Meta Ads reporting";

/** API names for technical/how-it-works copy. */
export const PLATFORM_LIST_API =
  "Meta Marketing API + CSV upload";

/** Freelancer (starter) plan — max client workspaces; enforced in lib/subscription.ts. */
export { AGENCY_CLIENT_LIMIT, PROFESSIONAL_CLIENT_LIMIT, AGENCY_PLUS_CLIENT_LIMIT } from "./launch-limits";

/** Pricing feature bullets — one client workspace = one brand; all platforms included in that slot. */
export const AGENCY_CLIENT_LIMIT_FEATURE =
  "Up to 10 client workspaces — Meta Ads reporting live today";

export const PROFESSIONAL_CLIENT_LIMIT_FEATURE =
  "Up to 50 client workspaces — Meta Ads reporting live today";

export { WHITE_LABEL_FEATURE } from "@/lib/report-branding";

/** Short explainer for paywall / upgrade screens. */
export const CLIENT_LIMIT_EXPLAINER =
  "Each client is one brand workspace. Meta Ads reporting uses one client slot whether you import by CSV or read-only API sync.";

export const AGENCY_PLUS_CLIENT_LIMIT_FEATURE = "Up to 100 client workspaces — Meta Ads reporting live today";
