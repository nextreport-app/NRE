/**
 * Google Analytics 4 — OAuth + Admin API (list properties) + Data API (runReport).
 *
 * Separate OAuth grant from NextAuth login, Google Drive, and Google Ads.
 * Uses GA4_CLIENT_ID / GA4_CLIENT_SECRET when set; falls back to GOOGLE_ADS_*
 * when the same Google Cloud OAuth client is reused with analytics scopes.
 */

export const GA4_READONLY_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
export const GA4_OAUTH_STATE_COOKIE = "ga4_oauth_state";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const GA4_ADMIN_BASE = "https://analyticsadmin.googleapis.com/v1beta";
const GA4_DATA_BASE = "https://analyticsdata.googleapis.com/v1beta";

export interface Ga4TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
}

export interface Ga4PropertySummary {
  /** Numeric property ID, e.g. "123456789" */
  propertyId: string;
  displayName: string;
  /** Parent account display name when available */
  accountName?: string;
}

function ga4ClientId(): string {
  const id = process.env.GA4_CLIENT_ID?.trim() || process.env.GOOGLE_ADS_CLIENT_ID?.trim();
  if (!id) throw new Error("GA4_CLIENT_ID (or GOOGLE_ADS_CLIENT_ID) is not configured");
  return id;
}

function ga4ClientSecret(): string {
  const secret = process.env.GA4_CLIENT_SECRET?.trim() || process.env.GOOGLE_ADS_CLIENT_SECRET?.trim();
  if (!secret) throw new Error("GA4_CLIENT_SECRET (or GOOGLE_ADS_CLIENT_SECRET) is not configured");
  return secret;
}

export function isGa4OAuthConfigured(): boolean {
  const hasDedicated = !!(process.env.GA4_CLIENT_ID?.trim() && process.env.GA4_CLIENT_SECRET?.trim());
  const hasFallback = !!(process.env.GOOGLE_ADS_CLIENT_ID?.trim() && process.env.GOOGLE_ADS_CLIENT_SECRET?.trim());
  return hasDedicated || hasFallback;
}

export function buildGa4ConnectUrl(redirectUri: string, state: string): string {
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", ga4ClientId());
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", `${GA4_READONLY_SCOPE} openid email`);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent select_account");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeGa4AuthCode(code: string, redirectUri: string): Promise<Ga4TokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: ga4ClientId(),
      client_secret: ga4ClientSecret(),
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    throw new Error(`Failed to exchange GA4 authorization code (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

export async function refreshGa4AccessToken(refreshToken: string): Promise<Ga4TokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: ga4ClientId(),
      client_secret: ga4ClientSecret(),
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    throw new Error(`Failed to refresh GA4 access token (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

export async function fetchGa4AccountEmail(accessToken: string): Promise<string | null> {
  const res = await fetch(GOOGLE_USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return null;
  const data = (await res.json()) as { email?: string };
  return data.email ?? null;
}

/** Lists GA4 properties the connected user can access (Admin API accountSummaries). */
export async function listGa4Properties(accessToken: string): Promise<Ga4PropertySummary[]> {
  const properties: Ga4PropertySummary[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(`${GA4_ADMIN_BASE}/accountSummaries`);
    url.searchParams.set("pageSize", "200");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) {
      throw new Error(`GA4 Admin API accountSummaries failed (${res.status}): ${await res.text()}`);
    }

    const data = (await res.json()) as {
      accountSummaries?: Array<{
        displayName?: string;
        propertySummaries?: Array<{ property?: string; displayName?: string }>;
      }>;
      nextPageToken?: string;
    };

    for (const account of data.accountSummaries ?? []) {
      for (const prop of account.propertySummaries ?? []) {
        const resource = prop.property ?? "";
        const match = resource.match(/properties\/(\d+)/);
        if (!match) continue;
        properties.push({
          propertyId: match[1],
          displayName: prop.displayName ?? `Property ${match[1]}`,
          accountName: account.displayName,
        });
      }
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  return properties.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export interface Ga4DateRange {
  startIso: string;
  endIso: string;
}

interface RunReportResponse {
  rows?: Array<{
    dimensionValues?: Array<{ value?: string }>;
    metricValues?: Array<{ value?: string }>;
  }>;
  metricHeaders?: Array<{ name?: string }>;
  totals?: Array<{ metricValues?: Array<{ value?: string }> }>;
}

function propertyResource(propertyId: string): string {
  const numeric = propertyId.replace(/^properties\//, "");
  return `properties/${numeric}`;
}

/** Runs a GA4 Data API report for one property and date range. */
export async function runGa4Report(
  accessToken: string,
  propertyId: string,
  body: {
    dateRanges: Array<{ startDate: string; endDate: string; name?: string }>;
    dimensions?: Array<{ name: string }>;
    metrics: Array<{ name: string }>;
    limit?: number;
    orderBys?: Array<{ metric?: { metricName: string }; desc?: boolean }>;
  },
): Promise<RunReportResponse> {
  const res = await fetch(`${GA4_DATA_BASE}/${propertyResource(propertyId)}:runReport`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`GA4 Data API runReport failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

/** Parses metric totals from a runReport response into a name → number map. */
export function parseGa4MetricTotals(response: RunReportResponse): Record<string, number> {
  const headers = response.metricHeaders?.map((h) => h.name ?? "") ?? [];
  const values = response.totals?.[0]?.metricValues ?? [];
  const out: Record<string, number> = {};
  headers.forEach((name, i) => {
    if (!name) return;
    out[name] = Number(values[i]?.value ?? 0);
  });
  return out;
}

/** Parses dimension + metric rows from a runReport response. */
export function parseGa4Rows(
  response: RunReportResponse,
  dimensionNames: string[],
  metricNames: string[],
): Array<Record<string, string | number>> {
  return (response.rows ?? []).map((row) => {
    const record: Record<string, string | number> = {};
    dimensionNames.forEach((name, i) => {
      record[name] = row.dimensionValues?.[i]?.value ?? "";
    });
    metricNames.forEach((name, i) => {
      record[name] = Number(row.metricValues?.[i]?.value ?? 0);
    });
    return record;
  });
}

/** ISO YYYY-MM-DD → GA4 date string (same format). */
export function toGa4Date(iso: string): string {
  return iso.slice(0, 10);
}
