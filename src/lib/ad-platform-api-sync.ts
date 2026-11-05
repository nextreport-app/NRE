/**
 * Meta wizard "Sync from API" import for controlled testing.
 *
 * The server passes capability to the client; explicit false is the kill switch.
 */

export function isAdPlatformApiSyncEnabled(): boolean {
  return process.env.AD_PLATFORM_API_SYNC_ENABLED !== "false";
}

/** Client detail "Platform connections" — always visible; connect flows may be preview until launch. */
export function isClientPlatformConnectionsSectionVisible(): boolean {
  return true;
}

/** Show the API source option, with availability supplied by the server. */
export function isWizardApiSyncVisible(): boolean {
  return true;
}

export function isWizardApiSyncEnabled(): boolean {
  return isWizardApiSyncVisible() && isAdPlatformApiSyncEnabled();
}
