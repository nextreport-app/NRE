/**
 * Public Google login (Continue with Google on /login and /signup).
 * Set NEXT_PUBLIC_GOOGLE_SIGNIN_ENABLED=true after Google OAuth app verification.
 */
export function isGoogleSignInEnabled(): boolean {
  return process.env.NEXT_PUBLIC_GOOGLE_SIGNIN_ENABLED === "true";
}
