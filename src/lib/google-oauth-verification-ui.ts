/**
 * Temporary production unlock for Google OAuth app verification (demo video + reviewers).
 * Meta-first launch stays unchanged when this is unset.
 *
 * Set GOOGLE_OAUTH_VERIFICATION_UI=true on Vercel only while recording/submitting verification;
 * remove or set false after approval to hide Google Ads / GA4 / API import again.
 */
export function isGoogleOAuthVerificationUiEnabled(): boolean {
  return process.env.GOOGLE_OAUTH_VERIFICATION_UI === "true";
}
