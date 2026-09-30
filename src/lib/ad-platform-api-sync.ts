/**
 * Meta / Google / TikTok wizard "Sync from API" import.
 * Set AD_PLATFORM_API_SYNC_ENABLED=false in the environment to hide API sync.
 */
export const AD_PLATFORM_API_SYNC_ENABLED = process.env.AD_PLATFORM_API_SYNC_ENABLED !== "false";
