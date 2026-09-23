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
  return "Beta — verify outputs before sending to clients.";
}

/** Full notice for wizard and settings panels. */
export const PLATFORM_BETA_NOTICE =
  "Google Ads, TikTok Ads, and GA4 are in beta. Meta Ads is fully tested — other platforms may have gaps or incomplete reporting. Please verify every report before sharing with clients.";
