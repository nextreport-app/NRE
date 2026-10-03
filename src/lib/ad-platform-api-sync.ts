/**
 * Meta / Google / TikTok wizard "Sync from API" import.
 *
 * On by default. Set AD_PLATFORM_API_SYNC_ENABLED=false in Vercel/env to hide API
 * import everywhere (wizard, settings, sync-api route). Optional Ads Manager reference
 * CSV on Meta sync forces Result columns to match manual export when needed.
 */
export const AD_PLATFORM_API_SYNC_ENABLED =
  process.env.AD_PLATFORM_API_SYNC_ENABLED !== "false";
