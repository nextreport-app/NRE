/**
 * Meta Marketing API client — read-only OAuth + Graph API helpers.
 *
 * Separate from NextAuth login (same pattern as google-drive.ts): a user
 * logs into NextReport with email/password or Google, then optionally
 * connects a Meta/Facebook account here to authorise ads_read access for
 * future automated report generation. Tokens live on User.meta* columns.
 */

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

/** Read-only scopes for performance reporting — no ads_management writes. */
export const META_ADS_SCOPES = ["ads_read", "business_management"] as const;

export const META_OAUTH_STATE_COOKIE = "meta_ads_oauth_state";

const DEFAULT_API_VERSION = "v26.0";

export function metaApiVersion(): string {
  return process.env.META_API_VERSION?.trim() || DEFAULT_API_VERSION;
}

export function metaGraphBase(): string {
  return `https://graph.facebook.com/${metaApiVersion()}`;
}

function requireMetaAppId(): string {
  const id = process.env.META_APP_ID?.trim();
  if (!id) throw new Error("META_APP_ID is not configured");
  return id;
}

function requireMetaAppSecret(): string {
  const secret = process.env.META_APP_SECRET?.trim();
  if (!secret) throw new Error("META_APP_SECRET is not configured");
  return secret;
}

export function buildMetaConnectUrl(redirectUri: string, state: string): string {
  const url = new URL(`https://www.facebook.com/${metaApiVersion()}/dialog/oauth`);
  url.searchParams.set("client_id", requireMetaAppId());
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", META_ADS_SCOPES.join(","));
  url.searchParams.set("state", state);
  return url.toString();
}

export interface MetaTokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
}

/** Exchanges the OAuth authorization code for a short-lived user access token. */
export async function exchangeMetaAuthCode(code: string, redirectUri: string): Promise<MetaTokenResponse> {
  const url = new URL(`${metaGraphBase()}/oauth/access_token`);
  url.searchParams.set("client_id", requireMetaAppId());
  url.searchParams.set("client_secret", requireMetaAppSecret());
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code", code);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Failed to exchange Meta authorization code (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

/** Converts a short-lived user token into a ~60-day long-lived token. */
export async function exchangeForLongLivedToken(shortLivedToken: string): Promise<MetaTokenResponse> {
  const url = new URL(`${metaGraphBase()}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", requireMetaAppId());
  url.searchParams.set("client_secret", requireMetaAppSecret());
  url.searchParams.set("fb_exchange_token", shortLivedToken);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Failed to exchange Meta long-lived token (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

export interface MetaUserProfile {
  id: string;
  name?: string;
}

export async function fetchMetaUserProfile(accessToken: string): Promise<MetaUserProfile> {
  const url = new URL(`${metaGraphBase()}/me`);
  url.searchParams.set("fields", "id,name");
  url.searchParams.set("access_token", accessToken);

  const res = await fetch(url.toString());
  const data = (await res.json()) as MetaUserProfile & { error?: { message: string } };
  if (!res.ok || data.error) {
    throw new Error(data.error?.message ?? `Failed to fetch Meta user profile (${res.status})`);
  }
  return { id: data.id, name: data.name };
}

export interface MetaAdAccount {
  id: string;
  name: string;
  account_id?: string;
  account_status?: number;
}

export async function fetchMetaAdAccounts(accessToken: string): Promise<MetaAdAccount[]> {
  const url = new URL(`${metaGraphBase()}/me/adaccounts`);
  url.searchParams.set("fields", "id,name,account_id,account_status");
  url.searchParams.set("limit", "100");
  url.searchParams.set("access_token", accessToken);

  const res = await fetch(url.toString());
  const data = (await res.json()) as { data?: MetaAdAccount[]; error?: { message: string } };
  if (!res.ok || data.error) {
    throw new Error(data.error?.message ?? `Failed to fetch Meta ad accounts (${res.status})`);
  }
  return data.data ?? [];
}

/** Ensures we have a valid long-lived token — refreshes if within 7 days of expiry. */
export async function ensureFreshMetaAccessToken(params: {
  accessToken: string;
  tokenExpiresAt: Date | null;
}): Promise<{ accessToken: string; tokenExpiresAt: Date | null; refreshed: boolean }> {
  const now = Date.now();
  const expiresAtMs = params.tokenExpiresAt?.getTime() ?? 0;
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  if (expiresAtMs - now > sevenDaysMs) {
    return { accessToken: params.accessToken, tokenExpiresAt: params.tokenExpiresAt, refreshed: false };
  }

  const tokens = await exchangeForLongLivedToken(params.accessToken);
  const expiresIn = tokens.expires_in ?? 60 * 24 * 60 * 60;
  return {
    accessToken: tokens.access_token,
    tokenExpiresAt: new Date(now + expiresIn * 1000),
    refreshed: true,
  };
}

function base64UrlDecode(input: string): Buffer {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + pad, "base64");
}

export interface MetaSignedRequestPayload {
  user_id: string;
  algorithm?: string;
  issued_at?: number;
}

/**
 * Parses and verifies Meta's signed_request (data-deletion callback).
 * Returns null when the signature is invalid.
 */
export function parseMetaSignedRequest(
  signedRequest: string,
  appSecret = requireMetaAppSecret(),
): MetaSignedRequestPayload | null {
  const parts = signedRequest.split(".");
  if (parts.length !== 2) return null;

  const [encodedSig, encodedPayload] = parts;
  const sig = base64UrlDecode(encodedSig);
  const expected = createHmac("sha256", appSecret).update(encodedPayload).digest();

  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload).toString("utf8")) as MetaSignedRequestPayload;
    if (!payload.user_id) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Confirmation code returned to Meta after a data-deletion callback. */
export function createMetaDeletionConfirmationCode(metaUserId: string): string {
  return `nre-del-${metaUserId}-${randomUUID().slice(0, 8)}`;
}
