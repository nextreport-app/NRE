/**
 * Meta / Google / TikTok wizard "Sync from API" import.
 *
 * Off by default — Meta Insights do not reliably match Ads Manager Result columns
 * for website-lead accounts. CSV upload is the supported import path until hybrid
 * sync is proven. Set AD_PLATFORM_API_SYNC_ENABLED=true to re-enable in the wizard.
 */
export const AD_PLATFORM_API_SYNC_ENABLED =
  process.env.AD_PLATFORM_API_SYNC_ENABLED === "true";
