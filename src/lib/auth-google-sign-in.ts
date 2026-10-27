/** Passed to Google OAuth on every login/signup so the account chooser always appears. */
export const GOOGLE_LOGIN_AUTHORIZATION_PARAMS = {
  // Login never requests Ads, Analytics or Drive access.
  scope: "openid profile email",
  prompt: "select_account",
} as const;
