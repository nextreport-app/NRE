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
