/**
 * Launch scope — which platforms and report types are selectable in product UI.
 * Update docs/META_LAUNCH_SCOPE.md when this changes.
 */

export const META_LAUNCH_PHASE = "meta-v1" as const;

/** Ad platforms selectable in the ads report wizard (GA4 uses the website wizard). */
export const LAUNCH_ENABLED_PLATFORMS = ["META"] as const;
export type LaunchEnabledPlatform = (typeof LAUNCH_ENABLED_PLATFORMS)[number];

const LIVE_PRODUCT_PLATFORMS = ["META"] as const;

/** Deferred platform cards stay hidden during manual Meta acceptance. */
export const SHOW_DEFERRED_PLATFORM_UI = false;

/** Retained implementations awaiting owner testing before public rollout. */
export const DEFERRED_PLATFORMS = ["GOOGLE", "TIKTOK", "GA4"] as const;

/** Supported engine types, including legacy one-day and multi-month modes. */
export const LAUNCH_ENABLED_REPORT_TYPES = ["WEEKLY", "MONTHLY", "DAILY", "HISTORICAL", "COMPARISON", "DAY_BREAKDOWN"] as const;
export type LaunchEnabledReportType = (typeof LAUNCH_ENABLED_REPORT_TYPES)[number];

export const DEFERRED_REPORT_TYPES = ["QUARTER", "YTD", "CREATIVE"] as const;
export const LAUNCH_PRIMARY_REPORT_TYPES: readonly LaunchEnabledReportType[] = ["WEEKLY", "MONTHLY", "COMPARISON", "DAY_BREAKDOWN"];
export const LAUNCH_SECONDARY_REPORT_TYPES: readonly LaunchEnabledReportType[] = [];

export function isLaunchPlatformEnabled(
  platform: string,
): platform is LaunchEnabledPlatform | "GA4" {
  return (LIVE_PRODUCT_PLATFORMS as readonly string[]).includes(platform);
}

export type ClientPlatformConnectionKey = "meta" | "googleAds" | "tiktok" | "ga4";

export function isWizardPlatformSwitchEnabled(): boolean {
  return LAUNCH_ENABLED_PLATFORMS.length > 1;
}

export function isClientPlatformConnectionVisible(key: ClientPlatformConnectionKey): boolean {
  // Connection management is independent of report-wizard rollout.
  return (["meta", "googleAds", "tiktok", "ga4"] as readonly string[]).includes(key);
}

export function isLaunchReportTypeEnabled(reportType: string): reportType is LaunchEnabledReportType {
  return (LAUNCH_ENABLED_REPORT_TYPES as readonly string[]).includes(reportType);
}

export function coerceLaunchReportType(reportType: string): LaunchEnabledReportType {
  if (isLaunchReportTypeEnabled(reportType)) return reportType;
  return "WEEKLY";
}

export function coerceLaunchPlatform(platform: string): LaunchEnabledPlatform {
  if ((LAUNCH_ENABLED_PLATFORMS as readonly string[]).includes(platform)) {
    return platform as LaunchEnabledPlatform;
  }
  return "META";
}

/** Shared marketing copy — keep in sync with docs/META_LAUNCH_SCOPE.md */
export const META_LAUNCH_HERO_BADGE = "Meta Ads reporting for agencies";

export const META_LAUNCH_HERO_SUBHEAD =
  "Upload a Meta Ads CSV from Ads Manager. Branded PowerPoint, live browser link, or Google Slides with AI-written insights — often under 2 minutes.";

export const META_LAUNCH_FOOTER_BLURB =
  "Automated Meta Ads reporting for digital agencies — client-ready decks in under two minutes.";

/** Public site — do not call these “live” until launch scope expands. */
export const LAUNCHING_SOON_PLATFORMS_LABEL = "Meta API sync";

export const DEFERRED_PLATFORMS_SHORT = "";

export const DEFERRED_LAUNCH_NOTICE = "";
