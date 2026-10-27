import type { Platform } from "@/lib/nre/google-columns";
import { LAUNCHING_SOON_PLATFORMS_LABEL } from "@/lib/meta-launch-scope";

/** Platforms still in beta — Meta Ads CSV is production-ready and fully tested. */
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
  return "Connection management is available for testing. Report generation remains hidden until platform testing is complete.";
}

/** Full notice for wizard and settings panels. */
export const PLATFORM_BETA_NOTICE = `Meta Ads CSV reporting is live. ${LAUNCHING_SOON_PLATFORMS_LABEL} is in testing — connections remain available in Account Settings, while report-wizard API import is hidden until testing is complete.`;
