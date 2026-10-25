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
export const PLATFORM_LIST_SHORT =
  "Meta Ads, Google Ads, TikTok Ads, and GA4 website reporting";

/** API names for technical/how-it-works copy. */
export const PLATFORM_LIST_API =
  "Meta Marketing API, Google Ads API, TikTok Marketing API, and GA4 Data API";

/** Agency (starter) plan — max client workspaces; enforced in lib/subscription.ts. */
export const AGENCY_CLIENT_LIMIT = 10;

/** Pricing feature bullets — one client workspace = one brand; all platforms included in that slot. */
export const AGENCY_CLIENT_LIMIT_FEATURE =
  "Up to 10 client workspaces — all ad platforms + GA4 included";

export const PROFESSIONAL_CLIENT_LIMIT_FEATURE =
  "Unlimited client workspaces — all ad platforms + GA4 included";

export { WHITE_LABEL_FEATURE } from "@/lib/report-branding";

/** Short explainer for paywall / upgrade screens. */
export const CLIENT_LIMIT_EXPLAINER =
  "Each client is one brand workspace. Meta, Google Ads, TikTok, and GA4 reporting for that brand uses one client slot — CSV upload or API sync where connected.";
