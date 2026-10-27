/**
 * Meta / Google / TikTok wizard "Sync from API" import (server + functional sync).
 *
 * Server capability is controlled by AD_PLATFORM_API_SYNC_ENABLED. Wizard
 * visibility is separate so existing configuration cannot expose API import.
 */

export function isAdPlatformApiSyncEnabled(): boolean {
  return process.env.AD_PLATFORM_API_SYNC_ENABLED === "true";
}

/** Client detail "Platform connections" — always visible; connect flows may be preview until launch. */
export function isClientPlatformConnectionsSectionVisible(): boolean {
  return true;
}

/** Keep API imports out of the wizard while manual CSV acceptance is in progress. */
export function isWizardApiSyncVisible(): boolean {
  return false;
}

export function isWizardApiSyncEnabled(): boolean {
  return isWizardApiSyncVisible() && isAdPlatformApiSyncEnabled();
}
