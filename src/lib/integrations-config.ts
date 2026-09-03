/** Server-side checks for platform API integrations (env vars present). */

export function isMetaApiConfigured(): boolean {
  return !!(process.env.META_APP_ID?.trim() && process.env.META_APP_SECRET?.trim());
}

/** Google Ads API — OAuth + developer token (see .env.example). */
export function isGoogleAdsApiConfigured(): boolean {
  return !!(
    process.env.GOOGLE_ADS_CLIENT_ID?.trim() &&
    process.env.GOOGLE_ADS_CLIENT_SECRET?.trim() &&
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim()
  );
}
