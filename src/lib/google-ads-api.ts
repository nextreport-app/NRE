/**
 * Google Ads API OAuth client — read-only reporting (adwords scope).
 *
 * Separate from NextAuth (AUTH_GOOGLE_*) and Google Drive connect
 * (googleDrive* columns). Uses GOOGLE_ADS_CLIENT_ID / GOOGLE_ADS_CLIENT_SECRET
 * and GOOGLE_ADS_DEVELOPER_TOKEN for API calls after OAuth.
 */

export const GOOGLE_ADS_SCOPE = "https://www.googleapis.com/auth/adwords";
export const GOOGLE_ADS_OAUTH_STATE_COOKIE = "google_ads_oauth_state";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const DEFAULT_API_VERSION = "v19";

export function googleAdsApiVersion(): string {
  return process.env.GOOGLE_ADS_API_VERSION?.trim() || DEFAULT_API_VERSION;
}

export function googleAdsApiBase(): string {
  return `https://googleads.googleapis.com/${googleAdsApiVersion()}`;
}

function requireGoogleAdsClientId(): string {
  const id = process.env.GOOGLE_ADS_CLIENT_ID?.trim();
  if (!id) throw new Error("GOOGLE_ADS_CLIENT_ID is not configured");
  return id;
}

function requireGoogleAdsClientSecret(): string {
  const secret = process.env.GOOGLE_ADS_CLIENT_SECRET?.trim();
  if (!secret) throw new Error("GOOGLE_ADS_CLIENT_SECRET is not configured");
  return secret;
}

export function requireGoogleAdsDeveloperToken(): string {
  const token = process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim();
  if (!token) throw new Error("GOOGLE_ADS_DEVELOPER_TOKEN is not configured");
  return token;
}

export function isGoogleAdsOAuthConfigured(): boolean {
  return !!(
    process.env.GOOGLE_ADS_CLIENT_ID?.trim() &&
    process.env.GOOGLE_ADS_CLIENT_SECRET?.trim() &&
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim()
  );
}

/** Starts account-settings "Connect Google Ads" OAuth — offline refresh token. */
export function buildGoogleAdsConnectUrl(redirectUri: string, state: string): string {
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", requireGoogleAdsClientId());
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_ADS_SCOPE);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent select_account");
  url.searchParams.set("state", state);
  return url.toString();
}

export interface GoogleAdsTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
}

export async function exchangeGoogleAdsAuthCode(
  code: string,
  redirectUri: string,
): Promise<GoogleAdsTokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requireGoogleAdsClientId(),
      client_secret: requireGoogleAdsClientSecret(),
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    throw new Error(`Failed to exchange Google Ads authorization code (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

export async function refreshGoogleAdsAccessToken(refreshToken: string): Promise<GoogleAdsTokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requireGoogleAdsClientId(),
      client_secret: requireGoogleAdsClientSecret(),
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    throw new Error(`Failed to refresh Google Ads access token (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

export async function fetchGoogleAdsAccountEmail(accessToken: string): Promise<string | null> {
  const res = await fetch(GOOGLE_USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return null;
  const data = (await res.json()) as { email?: string };
  return data.email ?? null;
}

/** CustomerService.ListAccessibleCustomers — verifies OAuth + developer token. */
export async function listAccessibleGoogleAdsCustomers(accessToken: string): Promise<string[]> {
  const url = `${googleAdsApiBase()}/customers:listAccessibleCustomers`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "developer-token": requireGoogleAdsDeveloperToken(),
    },
  });
  if (!res.ok) {
    throw new Error(`Google Ads ListAccessibleCustomers failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { resourceNames?: string[] };
  return data.resourceNames ?? [];
}
