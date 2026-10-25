/**
 * Meta / Google / TikTok wizard "Sync from API" import (server + functional sync).
 *
 * Off by default — UI still shows "Sync from API" with launching-soon copy. Set
 * AD_PLATFORM_API_SYNC_ENABLED=true to run sync and analyze from the wizard.
 */

export function isAdPlatformApiSyncEnabled(): boolean {
  return process.env.AD_PLATFORM_API_SYNC_ENABLED === "true";
}

/** Client detail "Platform connections" — always visible; connect flows may be preview until launch. */
export function isClientPlatformConnectionsSectionVisible(): boolean {
  return true;
}
