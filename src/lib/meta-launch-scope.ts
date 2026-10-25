/**
 * Meta-first launch scope — single source of truth for what is live vs deferred.
 * Re-enable items here (and in docs/META_LAUNCH_SCOPE.md) after Meta reporting
 * passes golden CSV/API parity tests in CI.
 *
 * Google OAuth verification: set GOOGLE_OAUTH_VERIFICATION_UI=true to expose Google Ads +
 * GA4 account connections, API import, and the website report wizard without a full launch.
 */

import { isGoogleOAuthVerificationUiEnabled } from "@/lib/google-oauth-verification-ui";

export const META_LAUNCH_PHASE = "meta-v1" as const;

/** Ad platforms available in the report wizard today. */
export const LAUNCH_ENABLED_PLATFORMS = ["META"] as const;
export type LaunchEnabledPlatform = (typeof LAUNCH_ENABLED_PLATFORMS)[number];

/** When false, deferred platform cards/sections stay out of UI until a platform goes live. */
export const SHOW_DEFERRED_PLATFORM_UI = false;

/** Shown in wizard/marketing as disabled — code paths kept for post-launch. */
export const DEFERRED_PLATFORMS = [
  { id: "GOOGLE" as const, label: "Google Ads", status: "Launching soon" },
  { id: "TIKTOK" as const, label: "TikTok Ads", status: "Launching soon" },
  { id: "GA4" as const, label: "Google Analytics", status: "Launching soon" },
] as const;

/** Report types selectable in the generate step (Meta only). */
export const LAUNCH_ENABLED_REPORT_TYPES = [
  "WEEKLY",
  "MONTHLY",
  "DAILY",
  "COMPARISON",
  "HISTORICAL",
  "DAY_BREAKDOWN",
] as const;
export type LaunchEnabledReportType = (typeof LAUNCH_ENABLED_REPORT_TYPES)[number];

/** Hidden from wizard UI until post-launch — backend still accepts for legacy reports. */
export const DEFERRED_REPORT_TYPES = [
  { id: "QUARTER" as const, label: "Quarterly Performance Report" },
  { id: "YTD" as const, label: "Year-to-Date Report" },
  { id: "CREATIVE" as const, label: "Creative Performance Report" },
] as const;

export const LAUNCH_PRIMARY_REPORT_TYPES: readonly LaunchEnabledReportType[] = [
  "WEEKLY",
  "MONTHLY",
  "DAILY",
];

export const LAUNCH_SECONDARY_REPORT_TYPES: readonly LaunchEnabledReportType[] = [
  "COMPARISON",
  "HISTORICAL",
  "DAY_BREAKDOWN",
];

export function isLaunchPlatformEnabled(platform: string): platform is LaunchEnabledPlatform {
  if ((LAUNCH_ENABLED_PLATFORMS as readonly string[]).includes(platform)) return true;
  if (isGoogleOAuthVerificationUiEnabled() && (platform === "GOOGLE" || platform === "GA4")) {
    return true;
  }
  return false;
}

/** Client manage page + account connection summary — hide deferred platforms until live. */
export type ClientPlatformConnectionKey = "meta" | "googleAds" | "tiktok" | "ga4";

/** Wizard import — hide “Change platform” until more than one ad platform is live. */
export function isWizardPlatformSwitchEnabled(): boolean {
  if (LAUNCH_ENABLED_PLATFORMS.length > 1) return true;
  return isGoogleOAuthVerificationUiEnabled();
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

/** Default report type when a deferred type was previously selected. */
export function coerceLaunchReportType(reportType: string): LaunchEnabledReportType {
  if (isLaunchReportTypeEnabled(reportType)) return reportType;
  return "WEEKLY";
}

export function coerceLaunchPlatform(platform: string): LaunchEnabledPlatform {
  if (isLaunchPlatformEnabled(platform)) return platform;
  return "META";
}

/** Shared marketing copy — keep in sync with docs/META_LAUNCH_SCOPE.md */
export const META_LAUNCH_HERO_BADGE = "Meta Ads reporting for agencies";

export const META_LAUNCH_HERO_SUBHEAD =
  "Upload a day-wise Meta CSV from Ads Manager. Branded PowerPoint, live browser link, or Google Slides with AI-written insights — often under 2 minutes.";

export const META_LAUNCH_FOOTER_BLURB =
  "Automated Meta Ads reporting for digital agencies — client-ready decks in under two minutes.";

export const DEFERRED_PLATFORMS_SHORT = "";

export const DEFERRED_LAUNCH_NOTICE = "";
