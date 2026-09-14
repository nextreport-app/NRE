/**
 * Google Ads API OAuth client — read-only reporting (adwords scope).
 *
 * Separate from NextAuth (AUTH_GOOGLE_*) and Google Drive connect
 * (googleDrive* columns). Uses GOOGLE_ADS_CLIENT_ID / GOOGLE_ADS_CLIENT_SECRET
 * for OAuth; GOOGLE_ADS_DEVELOPER_TOKEN is optional (Google Cloud project
 * access, 2026+) and omitted from request headers when unset.
 */

export const GOOGLE_ADS_SCOPE = "https://www.googleapis.com/auth/adwords";
export const GOOGLE_ADS_OAUTH_STATE_COOKIE = "google_ads_oauth_state";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const DEFAULT_API_VERSION = "v22";

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

/** Legacy developer token — optional; sent on API calls only when set (Google retires the header ~H1 2027). */
export function googleAdsDeveloperToken(): string | undefined {
  const token = process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim();
  return token || undefined;
}

export function isGoogleAdsOAuthConfigured(): boolean {
  return !!(
    process.env.GOOGLE_ADS_CLIENT_ID?.trim() &&
    process.env.GOOGLE_ADS_CLIENT_SECRET?.trim()
  );
}

function googleAdsRequestHeaders(accessToken: string, loginCustomerId?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
  const developerToken = googleAdsDeveloperToken();
  if (developerToken) headers["developer-token"] = developerToken;
  if (loginCustomerId) headers["login-customer-id"] = loginCustomerId.replace(/\D/g, "");
  return headers;
}

/** Starts account-settings "Connect Google Ads" OAuth — offline refresh token. */
export function buildGoogleAdsConnectUrl(redirectUri: string, state: string): string {
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", requireGoogleAdsClientId());
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", `${GOOGLE_ADS_SCOPE} openid email`);
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

/** CustomerService.ListAccessibleCustomers — verifies OAuth and Cloud project API access. */
export async function listAccessibleGoogleAdsCustomers(accessToken: string): Promise<string[]> {
  const headers = googleAdsRequestHeaders(accessToken);

  // v21 and below return HTML 404 today; retry newer versions if env pins an old one.
  const versions = [...new Set([googleAdsApiVersion(), "v22", "v24"])];
  let lastError: Error | null = null;

  for (const version of versions) {
    const url = `https://googleads.googleapis.com/${version}/customers:listAccessibleCustomers`;
    const res = await fetch(url, { method: "GET", headers });

    if (res.status === 404) {
      lastError = new Error(`Google Ads API ${version} not found (404)`);
      continue;
    }

    if (!res.ok) {
      const body = await res.text();
      const snippet = body.startsWith("<!DOCTYPE")
        ? "Google returned HTML (check OAuth scope and Google Ads API access on your Cloud project)"
        : body.slice(0, 500);
      throw new Error(`Google Ads ListAccessibleCustomers failed (${res.status}): ${snippet}`);
    }

    const data = (await res.json()) as { resourceNames?: string[]; resource_names?: string[] };
    return data.resourceNames ?? data.resource_names ?? [];
  }

  throw lastError ?? new Error("Google Ads ListAccessibleCustomers failed: no API version reachable");
}

export interface GoogleAdsSearchRow {
  campaign?: { name?: string; resourceName?: string; advertisingChannelType?: string };
  adGroup?: { name?: string; resourceName?: string };
  ad_group?: { name?: string; resourceName?: string };
  segments?: { date?: string };
  metrics?: {
    costMicros?: string;
    cost_micros?: string;
    clicks?: string;
    impressions?: string;
    ctr?: number;
    averageCpc?: number;
    average_cpc?: number;
    conversions?: number;
    conversionsValue?: number;
    conversions_value?: number;
    costPerConversion?: number;
    cost_per_conversion?: number;
    viewableImpressions?: number;
    viewable_impressions?: number;
    engagements?: number;
    videoViews?: number;
    video_views?: number;
  };
}

interface GoogleAdsSearchResponse {
  results?: GoogleAdsSearchRow[];
  nextPageToken?: string;
  next_page_token?: string;
}

/** Runs a GAQL query via GoogleAdsService.Search (paginated). */
export async function searchGoogleAds(params: {
  accessToken: string;
  customerId: string;
  query: string;
  loginCustomerId?: string;
}): Promise<GoogleAdsSearchRow[]> {
  const customerId = params.customerId.replace(/\D/g, "");
  const allRows: GoogleAdsSearchRow[] = [];
  let pageToken: string | undefined;

  do {
    const url = `${googleAdsApiBase()}/customers/${customerId}/googleAds:search`;
    const body: { query: string; pageToken?: string } = { query: params.query };
    if (pageToken) body.pageToken = pageToken;

    const res = await fetch(url, {
      method: "POST",
      headers: googleAdsRequestHeaders(params.accessToken, params.loginCustomerId),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      const snippet = text.startsWith("<!DOCTYPE")
        ? "Google returned HTML (check OAuth scope and Google Ads API access on your Cloud project)"
        : text.slice(0, 500);
      throw new Error(`Google Ads Search failed (${res.status}): ${snippet}`);
    }

    const data = (await res.json()) as GoogleAdsSearchResponse;
    allRows.push(...(data.results ?? []));
    pageToken = data.nextPageToken ?? data.next_page_token;
  } while (pageToken);

  return allRows;
}
