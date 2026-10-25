import type { Platform } from "@/lib/nre/google-columns";

/** Platforms still in beta — Meta Ads is production-ready and fully tested. */
export type PlatformBetaId = Platform | "GA4";

export const PLATFORM_BETA_STATUS: Record<PlatformBetaId, boolean> = {
  META: false,
  GOOGLE: true,
  TIKTOK: true,
  GA4: true,
};

export function isPlatformBeta(platform: PlatformBetaId): boolean {
  return PLATFORM_BETA_STATUS[platform];
}

/** Short line for cards and compact UI. */
export function platformBetaCardNote(platform: PlatformBetaId): string | null {
  if (!isPlatformBeta(platform)) return null;
  return "Beta — spot-check totals against the native platform export.";
}

/** Full notice for wizard and settings panels. */
export const PLATFORM_BETA_NOTICE =
  "Google Ads, TikTok Ads, and GA4 are in beta. Connect in Account settings, then use CSV upload or Sync from API in the wizard. Confirm key metrics against the ad platform or GA4 UI.";
