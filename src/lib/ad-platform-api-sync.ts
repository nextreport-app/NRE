/**
 * Meta / Google / TikTok wizard "Sync from API" import.
 *
 * Off by default (hidden wizard toggle, settings connect CTAs, /sync-api route).
 * Set AD_PLATFORM_API_SYNC_ENABLED=true in env to re-enable for internal testing.
 * Optional Ads Manager reference CSV on Meta sync remains in code when enabled.
 */
export const AD_PLATFORM_API_SYNC_ENABLED =
  process.env.AD_PLATFORM_API_SYNC_ENABLED === "true";

/** Client detail "Platform connections" + Connect CTAs — only when wizard API import is on. */
export function isClientPlatformConnectionsSectionVisible(): boolean {
  return AD_PLATFORM_API_SYNC_ENABLED;
}
