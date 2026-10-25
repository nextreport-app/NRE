/**
 * User-facing copy when stored Google Ads / GA4 refresh tokens no longer work.
 * Common causes: OAuth client secret rotated in Google Cloud, Vercel env mismatch,
 * or tokens issued before redirect URI / client id change.
 */
export function googleOAuthReconnectMessage(service: "Google Ads" | "Google Analytics"): string {
  return (
    `Could not refresh ${service} access — your connection is stale. ` +
    `In Account settings, click Disconnect, then Connect again (choose Allow on Google's consent screen). ` +
    `If this keeps happening, confirm Production Vercel env matches the OAuth client in Google Cloud ` +
    `(client ID, client secret, and callback URLs for nextreport.in).`
  );
}

export function isGoogleOAuthRefreshFailure(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /invalid_grant|Failed to refresh|invalid authentication|UNAUTHENTICATED/i.test(msg);
}
