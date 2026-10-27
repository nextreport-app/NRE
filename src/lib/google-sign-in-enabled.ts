/**
 * Google login/signup is enabled independently of Ads/Analytics verification.
 * Keep the shared policy for the UI and NextAuth provider in sync. The former
 * NEXT_PUBLIC_GOOGLE_SIGNIN_ENABLED gate is retired, including stale false values.
 */
export function isGoogleSignInEnabled(): boolean {
  return true;
}
