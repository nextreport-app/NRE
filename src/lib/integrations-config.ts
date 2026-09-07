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

/** Google Analytics 4 — OAuth client for Analytics Data + Admin APIs (see .env.example). */
export function isGa4ApiConfigured(): boolean {
  const hasDedicated = !!(process.env.GA4_CLIENT_ID?.trim() && process.env.GA4_CLIENT_SECRET?.trim());
  const hasFallback = !!(process.env.GOOGLE_ADS_CLIENT_ID?.trim() && process.env.GOOGLE_ADS_CLIENT_SECRET?.trim());
  return hasDedicated || hasFallback;
}

/** TikTok Marketing API — OAuth app credentials (see .env.example). */
export function isTikTokApiConfigured(): boolean {
  return !!(process.env.TIKTOK_APP_ID?.trim() && process.env.TIKTOK_APP_SECRET?.trim());
}
