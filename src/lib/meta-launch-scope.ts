/**
 * Launch scope — which platforms and report types are selectable in product UI.
 * Update docs/META_LAUNCH_SCOPE.md when this changes.
 */

export const META_LAUNCH_PHASE = "multi-platform" as const;

/** Ad platforms selectable in the ads report wizard (GA4 uses the website wizard). */
export const LAUNCH_ENABLED_PLATFORMS = ["META", "GOOGLE", "TIKTOK"] as const;
export type LaunchEnabledPlatform = (typeof LAUNCH_ENABLED_PLATFORMS)[number];

const LIVE_PRODUCT_PLATFORMS = ["META", "GOOGLE", "TIKTOK", "GA4"] as const;

/** Legacy flag — all platforms are enabled via LAUNCH_ENABLED_PLATFORMS. */
export const SHOW_DEFERRED_PLATFORM_UI = false;

/** Reserved for future staged rollouts (empty while all platforms are live). */
export const DEFERRED_PLATFORMS = [] as const;

/** Report types selectable in the generate step. */
export const LAUNCH_ENABLED_REPORT_TYPES = [
  "WEEKLY",
  "MONTHLY",
  "DAILY",
  "COMPARISON",
  "HISTORICAL",
  "DAY_BREAKDOWN",
  "QUARTER",
  "YTD",
  "CREATIVE",
] as const;
export type LaunchEnabledReportType = (typeof LAUNCH_ENABLED_REPORT_TYPES)[number];

export const DEFERRED_REPORT_TYPES = [] as const;

export const LAUNCH_PRIMARY_REPORT_TYPES: readonly LaunchEnabledReportType[] = [
  "WEEKLY",
  "MONTHLY",
  "DAILY",
];

export const LAUNCH_SECONDARY_REPORT_TYPES: readonly LaunchEnabledReportType[] = [
  "COMPARISON",
  "HISTORICAL",
  "DAY_BREAKDOWN",
  "QUARTER",
  "YTD",
  "CREATIVE",
];

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
  switch (key) {
    case "meta":
      return isLaunchPlatformEnabled("META");
    case "googleAds":
      return isLaunchPlatformEnabled("GOOGLE");
    case "tiktok":
      return isLaunchPlatformEnabled("TIKTOK");
    case "ga4":
      return isLaunchPlatformEnabled("GA4");
    default:
      return false;
  }
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
export const META_LAUNCH_HERO_BADGE = "Meta, Google Ads, TikTok & GA4 reporting for agencies";

export const META_LAUNCH_HERO_SUBHEAD =
  "Upload a CSV or sync from API — Meta, Google Ads, TikTok, and GA4 website traffic. Branded PowerPoint, live browser link, or Google Slides with AI-written insights — often under 2 minutes.";

export const META_LAUNCH_FOOTER_BLURB =
  "Automated multi-platform reporting for digital agencies — ad platforms and GA4 website decks in one workflow.";

export const DEFERRED_PLATFORMS_SHORT = "";

export const DEFERRED_LAUNCH_NOTICE = "";
