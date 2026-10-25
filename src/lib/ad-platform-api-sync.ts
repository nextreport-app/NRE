/**
 * Meta / Google / TikTok wizard "Sync from API" import and account Connect CTAs.
 *
 * On by default. Set AD_PLATFORM_API_SYNC_ENABLED=false to hide API import and
 * show CSV-only messaging in account settings.
 * Optional Ads Manager reference CSV on Meta sync remains in code when enabled.
 */

export function isAdPlatformApiSyncEnabled(): boolean {
  return process.env.AD_PLATFORM_API_SYNC_ENABLED !== "false";
}

/** Client detail "Platform connections" + Connect CTAs — only when wizard API import is on. */
export function isClientPlatformConnectionsSectionVisible(): boolean {
  return isAdPlatformApiSyncEnabled();
}
