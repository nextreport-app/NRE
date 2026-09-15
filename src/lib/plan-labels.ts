/**
 * Human-readable plan names for UI and checkout.
 * Internal planId values (`starter`, `professional`) stay unchanged for billing/subscription.
 */
export const PLAN_DISPLAY_NAMES = {
  trial: "Free Trial",
  starter: "Agency",
  professional: "Professional",
  cancelled: "Cancelled",
} as const;

export type BillablePlanId = "starter" | "professional";

export function getPlanDisplayName(planId: string): string {
  return PLAN_DISPLAY_NAMES[planId as keyof typeof PLAN_DISPLAY_NAMES] ?? planId;
}

/** Short platform list for marketing headlines and feature bullets. */
export const PLATFORM_LIST_SHORT = "Meta Ads, Google Ads, TikTok Ads, and Google Analytics (GA4)";

/** API names for technical/how-it-works copy. */
export const PLATFORM_LIST_API =
  "Meta Marketing API, Google Ads API, TikTok Marketing API, and GA4 Data API";

/** Agency (starter) plan — max client workspaces; enforced in lib/subscription.ts. */
export const AGENCY_CLIENT_LIMIT = 10;

/** Pricing feature bullets — one client workspace = one brand; all platforms included in that slot. */
export const AGENCY_CLIENT_LIMIT_FEATURE =
  "Up to 10 clients — Meta, Google, TikTok & GA4 included";

export const PROFESSIONAL_CLIENT_LIMIT_FEATURE = "Unlimited clients — all platforms included";

/** Short explainer for paywall / upgrade screens. */
export const CLIENT_LIMIT_EXPLAINER =
  "Each client is one brand workspace. Meta, Google, TikTok, and GA4 reports for that brand all count as one client — not one slot per platform.";
