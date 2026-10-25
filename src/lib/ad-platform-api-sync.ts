/**
 * Meta / Google / TikTok wizard "Sync from API" import.
 *
 * Off by default (hidden wizard toggle, settings connect CTAs, /sync-api route).
 * Set AD_PLATFORM_API_SYNC_ENABLED=true in env to re-enable for internal testing.
 * GOOGLE_OAUTH_VERIFICATION_UI=true also turns this on (Google Ads connect + API demo for reviewers).
 * Optional Ads Manager reference CSV on Meta sync remains in code when enabled.
 */
import { isGoogleOAuthVerificationUiEnabled } from "@/lib/google-oauth-verification-ui";

export function isAdPlatformApiSyncEnabled(): boolean {
  return (
    process.env.AD_PLATFORM_API_SYNC_ENABLED === "true" || isGoogleOAuthVerificationUiEnabled()
  );
}

/** Client detail "Platform connections" + Connect CTAs — only when wizard API import is on. */
export function isClientPlatformConnectionsSectionVisible(): boolean {
  return isAdPlatformApiSyncEnabled();
}
