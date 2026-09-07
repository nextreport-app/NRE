/**
 * TikTok Marketing API client — read-only OAuth + reporting helpers.
 *
 * Separate from NextAuth login (same pattern as meta-api.ts / google-ads-api.ts).
 * Tokens live on User.tiktok* columns. API v1.3 — Access-Token header on every call.
 */

import { randomUUID } from "node:crypto";

export const TIKTOK_OAUTH_STATE_COOKIE = "tiktok_ads_oauth_state";

const API_BASE = "https://business-api.tiktok.com/open_api/v1.3";
const AUTH_PORTAL = "https://business-api.tiktok.com/portal/auth";

interface TikTokEnvelope<T> {
  code: number;
  message: string;
  request_id?: string;
  data?: T;
}

function requireTikTokAppId(): string {
  const id = process.env.TIKTOK_APP_ID?.trim();
  if (!id) throw new Error("TIKTOK_APP_ID is not configured");
  return id;
}

function requireTikTokAppSecret(): string {
  const secret = process.env.TIKTOK_APP_SECRET?.trim();
  if (!secret) throw new Error("TIKTOK_APP_SECRET is not configured");
  return secret;
}

export function isTikTokOAuthConfigured(): boolean {
  return !!(process.env.TIKTOK_APP_ID?.trim() && process.env.TIKTOK_APP_SECRET?.trim());
}

export function buildTikTokConnectUrl(redirectUri: string, state: string): string {
  const url = new URL(AUTH_PORTAL);
  url.searchParams.set("app_id", requireTikTokAppId());
  url.searchParams.set("state", state);
  url.searchParams.set("redirect_uri", redirectUri);
  return url.toString();
}

export interface TikTokTokenData {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  advertiser_ids?: string[];
  scope?: string[];
}

async function parseTikTokJson<T>(res: Response, label: string): Promise<T> {
  const body = (await res.json()) as TikTokEnvelope<T>;
  if (!res.ok || body.code !== 0) {
    throw new Error(`${label} failed (${body.code ?? res.status}): ${body.message ?? await res.text()}`);
  }
  if (!body.data) throw new Error(`${label} returned no data`);
  return body.data;
}

/** Exchanges the OAuth authorization code for access + refresh tokens. */
export async function exchangeTikTokAuthCode(authCode: string): Promise<TikTokTokenData> {
  const res = await fetch(`${API_BASE}/oauth2/access_token/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_id: requireTikTokAppId(),
      secret: requireTikTokAppSecret(),
      auth_code: authCode,
    }),
  });
  return parseTikTokJson<TikTokTokenData>(res, "TikTok token exchange");
}

/** Refreshes an expired access token using the long-lived refresh token. */
export async function refreshTikTokAccessToken(refreshToken: string): Promise<TikTokTokenData> {
  const res = await fetch(`${API_BASE}/oauth2/refresh_token/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_id: requireTikTokAppId(),
      secret: requireTikTokAppSecret(),
      refresh_token: refreshToken,
    }),
  });
  return parseTikTokJson<TikTokTokenData>(res, "TikTok token refresh");
}

export interface TikTokAdvertiser {
  advertiser_id: string;
  advertiser_name?: string;
}

/** Lists advertiser accounts authorized for this access token. */
export async function fetchTikTokAdvertisers(accessToken: string): Promise<TikTokAdvertiser[]> {
  const url = new URL(`${API_BASE}/oauth2/advertiser/get/`);
  url.searchParams.set("app_id", requireTikTokAppId());
  url.searchParams.set("secret", requireTikTokAppSecret());

  const res = await fetch(url.toString(), {
    headers: { "Access-Token": accessToken },
  });

  const data = await parseTikTokJson<{ list?: TikTokAdvertiser[] }>(res, "TikTok advertiser list");
  return data.list ?? [];
}

export interface TikTokReportRow {
  dimensions?: Record<string, string>;
  metrics?: Record<string, string>;
}

export interface FetchTikTokIntegratedReportInput {
  accessToken: string;
  advertiserId: string;
  startDate: string;
  endDate: string;
  page?: number;
  pageSize?: number;
}

/**
 * Pulls ad-group-level daily performance via report/integrated/get/.
 * Returns raw API rows — fetch-tiktok-report-rows.ts converts to Meta-shaped CSV.
 */
export async function fetchTikTokIntegratedReport(input: FetchTikTokIntegratedReportInput): Promise<TikTokReportRow[]> {
  const res = await fetch(`${API_BASE}/report/integrated/get/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Access-Token": input.accessToken,
    },
    body: JSON.stringify({
      advertiser_id: input.advertiserId,
      report_type: "BASIC",
      data_level: "AUCTION_ADGROUP",
      dimensions: ["campaign_id", "adgroup_id", "stat_time_day"],
      metrics: [
        "campaign_name",
        "adgroup_name",
        "spend",
        "impressions",
        "reach",
        "frequency",
        "clicks",
        "ctr",
        "cpc",
        "conversion",
        "cost_per_conversion",
        "conversion_rate",
      ],
      start_date: input.startDate,
      end_date: input.endDate,
      page: input.page ?? 1,
      page_size: input.pageSize ?? 1000,
    }),
  });

  const data = await parseTikTokJson<{ list?: TikTokReportRow[]; page_info?: { total_page?: number } }>(
    res,
    "TikTok integrated report",
  );

  const rows = data.list ?? [];
  const totalPages = data.page_info?.total_page ?? 1;
  const page = input.page ?? 1;

  if (page < totalPages) {
    const next = await fetchTikTokIntegratedReport({ ...input, page: page + 1 });
    return rows.concat(next);
  }

  return rows;
}

export async function ensureFreshTikTokAccessToken(input: {
  accessToken: string;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
}): Promise<{ accessToken: string; refreshToken: string | null; tokenExpiresAt: Date | null; refreshed: boolean }> {
  const bufferMs = 5 * 60 * 1000;
  const expiresSoon =
    input.tokenExpiresAt && input.tokenExpiresAt.getTime() - Date.now() < bufferMs;

  if (!expiresSoon || !input.refreshToken) {
    return {
      accessToken: input.accessToken,
      refreshToken: input.refreshToken,
      tokenExpiresAt: input.tokenExpiresAt,
      refreshed: false,
    };
  }

  const refreshed = await refreshTikTokAccessToken(input.refreshToken);
  const expiresIn = refreshed.expires_in ?? 86400;
  return {
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token ?? input.refreshToken,
    tokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
    refreshed: true,
  };
}

/** Stable request id for logs when TikTok does not return one. */
export function tiktokRequestId(): string {
  return randomUUID();
}
