/**
 * Meta / Google / TikTok wizard "Sync from API" import and account Connect CTAs.
 *
 * Off by default — only Meta CSV is live in product messaging. Set
 * AD_PLATFORM_API_SYNC_ENABLED=true for internal testing / OAuth verification.
 */

export function isAdPlatformApiSyncEnabled(): boolean {
  return process.env.AD_PLATFORM_API_SYNC_ENABLED === "true";
}

/** Client detail "Platform connections" + Connect CTAs — only when wizard API import is on. */
export function isClientPlatformConnectionsSectionVisible(): boolean {
  return isAdPlatformApiSyncEnabled();
}
