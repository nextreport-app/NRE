/**
 * Meta / Google / TikTok wizard "Sync from API" import.
 *
 * On by default. Meta lead campaigns require a manual Ads Manager CSV alongside API
 * sync (hybrid merge). Set AD_PLATFORM_API_SYNC_ENABLED=false to hide API import.
 */
export const AD_PLATFORM_API_SYNC_ENABLED =
  process.env.AD_PLATFORM_API_SYNC_ENABLED !== "false";
