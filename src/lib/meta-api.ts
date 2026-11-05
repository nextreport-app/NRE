/**
 * Meta Marketing API client — read-only OAuth + Graph API helpers.
 *
 * Separate from NextAuth login (same pattern as google-drive.ts): a user
 * logs into NextReport with email/password or Google, then optionally
 * connects a Meta/Facebook account here to authorise ads_read access for
 * future automated report generation. Tokens live on User.meta* columns.
 */

import { ServiceError } from "./service-error";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { splitIsoDateRangeIntoChunks } from "@/lib/nre/api-date-range";

export { splitIsoDateRangeIntoChunks };

/** Read-only scopes for performance reporting — no ads_management writes. */
export const META_ADS_SCOPES = ["ads_read"] as const;

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

/** Never log provider token responses or credential-bearing OAuth URLs. */
async function fetchMetaToken(url: URL): Promise<MetaTokenResponse> {
  try {
    const response = await fetch(url.toString(), { cache: "no-store", signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error("Meta rejected token exchange");
    const data = await response.json() as MetaTokenResponse;
    if (!data.access_token) throw new Error("Meta returned no token");
    return data;
  } catch {
    throw new Error("Could not connect to Meta. Please reconnect your account.");
  }
}

/** Only trusted Graph GETs; bearer tokens stay out of request URLs and pagination cannot redirect credentials. */
async function fetchMetaGraph(input: string | URL, accessToken: string): Promise<Response> {
  const url = new URL(input);
  if (url.protocol !== "https:" || url.hostname !== "graph.facebook.com" || url.port || url.username || url.password) throw new Error("Invalid Meta pagination destination.");
  url.searchParams.delete("access_token");
  url.searchParams.delete("appsecret_proof");
  const secret = process.env.META_APP_SECRET?.trim();
  if (secret) url.searchParams.set("appsecret_proof", createHmac("sha256", secret).update(accessToken).digest("hex"));
  return fetch(url.toString(), { method: "GET", headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store", signal: AbortSignal.timeout(45_000) });
}

/** Exchanges the OAuth authorization code for a short-lived user access token. */
export async function exchangeMetaAuthCode(code: string, redirectUri: string): Promise<MetaTokenResponse> {
  const url = new URL(`${metaGraphBase()}/oauth/access_token`);
  url.searchParams.set("client_id", requireMetaAppId());
  url.searchParams.set("client_secret", requireMetaAppSecret());
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code", code);

  return fetchMetaToken(url);
}

/** Converts a short-lived user token into a ~60-day long-lived token. */
export async function exchangeForLongLivedToken(shortLivedToken: string): Promise<MetaTokenResponse> {
  const url = new URL(`${metaGraphBase()}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", requireMetaAppId());
  url.searchParams.set("client_secret", requireMetaAppSecret());
  url.searchParams.set("fb_exchange_token", shortLivedToken);

  return fetchMetaToken(url);
}

export interface MetaUserProfile {
  id: string;
  name?: string;
}

export async function fetchMetaUserProfile(accessToken: string): Promise<MetaUserProfile> {
  const url = new URL(`${metaGraphBase()}/me`);
  url.searchParams.set("fields", "id,name");
  url.searchParams.set("access_token", accessToken);

  const res = await fetchMetaGraph(url, accessToken);
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
  currency?: string;
  timezone_name?: string;
}

export async function fetchMetaAdAccounts(accessToken: string): Promise<MetaAdAccount[]> {
  const url = new URL(`${metaGraphBase()}/me/adaccounts`);
  url.searchParams.set("fields", "id,name,account_id,account_status,currency,timezone_name");
  url.searchParams.set("limit", "100");
  url.searchParams.set("access_token", accessToken);

  const accounts: MetaAdAccount[] = [];
  const seen = new Set<string>();
  let next: string | null = url.toString();
  while (next) {
    if (seen.has(next) || seen.size >= 1000) throw new Error("Meta account pagination could not finish. Please retry.");
    seen.add(next);
    const res = await fetchMetaGraph(next, accessToken);
    const data = await res.json() as { data?: MetaAdAccount[]; paging?: { next?: string }; error?: { message: string } };
    if (!res.ok || data.error) throw new Error(data.error?.message ?? `Failed to fetch Meta ad accounts (${res.status})`);
    accounts.push(...(data.data ?? []));
    next = data.paging?.next ?? null;
  }
  return accounts;

}

export interface MetaAdAccountMetadata { id: string; name?: string; currency: string; timezone_name: string; }
export async function fetchMetaAdAccountMetadata(accessToken: string, accountId: string): Promise<MetaAdAccountMetadata> {
  if (!/^(act_)?\d+$/.test(accountId)) throw new Error("Choose a valid Meta ad account.");
  const id = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
  const url = new URL(`${metaGraphBase()}/${id}`);
  url.searchParams.set("fields", "id,name,currency,timezone_name");
  const response = await fetchMetaGraph(url, accessToken);
  const data = await response.json() as MetaAdAccountMetadata & { error?: { message?: string } };
  if (!response.ok || data.error || !/^[A-Z]{3}$/.test(data.currency ?? "") || !data.timezone_name) throw new Error("Meta could not confirm this account's currency and timezone. Reconnect Meta or choose another account.");
  new Intl.DateTimeFormat("en-US", { timeZone: data.timezone_name });
  return data;
}

export interface MetaAdSetReportingConfig {
  id: string;
  optimization_goal?: string;
  promoted_object?: { pixel_id?: string; custom_conversion_id?: string; custom_event_type?: string };
}

function adSetSettingsError(error: MetaGraphErrorDetails | undefined, status: number): ServiceError {
  const code = error?.code;
  const suffix = code == null ? `HTTP ${status}` : `Meta code ${code}${error?.error_subcode == null ? "" : `/${error.error_subcode}`}`;
  if (code === 190) return new ServiceError(`Your Meta login expired or was revoked (${suffix}). Reconnect Meta to continue.`, 401);
  if (code === 10 || code === 200) return new ServiceError(`Meta denied access to an ad set's conversion settings (${suffix}). Check that the connected user has reporting access to this ad account.`, 403);
  if (status === 429 || [4, 17, 32, 613].includes(code ?? -1)) return new ServiceError(`Meta is limiting reporting requests (${suffix}). Wait a moment and retry sync; reconnecting is not required.`, 429, 30);
  // Never include provider messages, response bodies or credential-bearing URLs.
  if (code === 100) return new ServiceError(`Meta could not read an ad set's conversion settings (${suffix}). The ad set may be deleted or unavailable to the connected user.`, 422);
  return new ServiceError(`Meta could not read an ad set's conversion settings (${suffix}). Retry sync. Your connection has not been changed.`, 502);
}

async function fetchMetaAdSetReportingConfig(accessToken: string, id: string): Promise<MetaAdSetReportingConfig> {
  const url = new URL(`${metaGraphBase()}/${id}`);
  url.searchParams.set("fields", "id,optimization_goal,promoted_object");
  for (let attempt = 0; attempt < 3; attempt++) {
    let response: Response;
    try {
      response = await fetchMetaGraph(url, accessToken);
    } catch {
      if (attempt < 2) { await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1))); continue; }
      throw new ServiceError("Meta's ad set settings request timed out or could not connect. Retry sync; reconnecting is not required.", 502);
    }
    const data = await response.json().catch(() => null) as (MetaAdSetReportingConfig & { error?: MetaGraphErrorDetails }) | null;
    if (response.ok && data && !data.error && data.id === id && typeof data.optimization_goal === "string" && data.optimization_goal.trim()) return data;
    const code = data?.error?.code;
    const transient = response.status === 429 || response.status >= 500 || [1, 2, 4, 17, 32, 613].includes(code ?? -1);
    if (transient && attempt < 2) { await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1))); continue; }
    if (response.ok && !data?.error) throw new ServiceError("Meta returned incomplete ad set conversion settings. Retry sync; results have not been estimated.", 502);
    throw adSetSettingsError(data?.error, response.status);
  }
  throw new ServiceError("Meta could not read ad set conversion settings. Retry sync.", 502);
}

/** Read supported AdSet nodes directly; bound concurrency rather than relying on root multi-ID field expansion. */
export async function fetchMetaAdSetReportingConfigs(accessToken: string, ids: string[]): Promise<MetaAdSetReportingConfig[]> {
  const unique = [...new Set(ids)];
  if (unique.some(id => !/^\d+$/.test(id))) throw new ServiceError("Meta returned an invalid ad set ID.", 422);
  const configs: MetaAdSetReportingConfig[] = [];
  for (let offset = 0; offset < unique.length; offset += 4) {
    const group = unique.slice(offset, offset + 4);
    // Wait for every request in this group before retrying or starting another group.
    const results = await Promise.allSettled(group.map(id => fetchMetaAdSetReportingConfig(accessToken, id)));
    for (const result of results) {
      if (result.status === "rejected") throw result.reason;
      configs.push(result.value);
    }
  }
  return configs;
}

export interface MetaInsightAction {
  action_type: string;
  value: string;
}

/** Meta result channels can include broader totals than the configured website conversion event. */
export interface MetaInsightResultMetric {
  indicator?: string;
  values?: Array<{ value?: string }>;
}

export interface MetaInsightRow {
  campaign_name?: string;
  adset_name?: string;
  spend?: string;
  reach?: string;
  impressions?: string;
  ctr?: string;
  cpc?: string;
  inline_link_clicks?: string;
  inline_link_click_ctr?: string;
  /** Resolved from ad-set promoted_object, never guessed from campaign naming. */
  configured_result_action?: string;
  clicks?: string;
  campaign_id?: string;
  adset_id?: string;
  frequency?: string;
  date_start?: string;
  date_stop?: string;
  /** Ad-set optimization goal — used to pick the objective-aligned result from actions[]. */
  optimization_goal?: string;
  actions?: MetaInsightAction[];
  cost_per_action_type?: MetaInsightAction[];
  /** Legacy result-channel projection; not a duplicate of the actions.value count. */
  results?: MetaInsightResultMetric[];
  cost_per_result?: MetaInsightResultMetric[];
  /** Objective-aligned results / CPR — often paired when results[] is incomplete. */
  objective_results?: MetaInsightResultMetric[];
  cost_per_objective_result?: MetaInsightResultMetric[];
}

export interface MetaGraphErrorDetails {
  message: string;
  code?: number;
  error_subcode?: number;
  fbtrace_id?: string;
}

interface MetaInsightsResponse {
  data?: MetaInsightRow[];
  paging?: { next?: string };
  error?: MetaGraphErrorDetails;
}

/** Meta insights error code 1 — "An unknown error occurred" — is usually transient or the request is too large. */
export function isRetryableMetaInsightsError(error: MetaGraphErrorDetails): boolean {
  return error.code === 1 || error.code === 2;
}

export function formatMetaInsightsErrorMessage(error: MetaGraphErrorDetails): string {
  const raw = error.message?.trim() || "Unexpected Meta API error";
  if (error.code === 1 || raw === "An unknown error occurred") {
    return "Meta temporarily couldn't fetch your campaign data (this usually clears after a retry). Wait a few seconds and tap Import again. If it keeps failing, reconnect Meta under Account Settings.";
  }
  if (error.code === 4 || error.code === 17) {
    return "Meta API rate limit reached. Please wait a minute and try again.";
  }
  if (error.code === 10 || error.code === 190) {
    return "Your Meta connection doesn't have permission for this ad account. Reconnect Meta under Account Settings and ensure this account is assigned to the connected user.";
  }
  return raw;
}

export class MetaInsightsFetchError extends Error {
  readonly meta: MetaGraphErrorDetails;

  constructor(meta: MetaGraphErrorDetails) {
    super(formatMetaInsightsErrorMessage(meta));
    this.name = "MetaInsightsFetchError";
    this.meta = meta;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const META_INSIGHT_FIELDS = [
  "campaign_id",
  "adset_id",
  "clicks",
  "campaign_name",
  "adset_name",
  "spend",
  "reach",
  "impressions",
  "ctr",
  "cpc",
  "inline_link_clicks",
  "inline_link_click_ctr",
  "frequency",
  "optimization_goal",
  "actions",
  "cost_per_action_type",
  "results",
  "cost_per_result",
  "objective_results",
  "cost_per_objective_result",
  "date_start",
  "date_stop",
].join(",");

async function fetchMetaInsightsPageWithRetry(url: string, accessToken: string, maxRetries = 3): Promise<MetaInsightsResponse> {
  let lastError: MetaGraphErrorDetails | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      await sleep(1500 * attempt);
    }

    const res = await fetchMetaGraph(url, accessToken);
    const data = (await res.json()) as MetaInsightsResponse;
    if (res.ok && !data.error) {
      return data;
    }

    lastError = data.error ?? { message: `Failed to fetch Meta insights (${res.status})` };
    if (!isRetryableMetaInsightsError(lastError) || attempt === maxRetries) {
      throw new MetaInsightsFetchError(lastError);
    }
  }

  throw new MetaInsightsFetchError(lastError ?? { message: "Failed to fetch Meta insights" });
}

export type MetaInsightsLevel = "campaign" | "adset";

async function fetchMetaAdAccountInsightsForRange(params: {
  accessToken: string;
  adAccountId: string;
  sinceIso: string;
  untilIso: string;
  level?: MetaInsightsLevel;
  /** Strict wizard imports use only the canonical actions channel for conversion counts. */
  includeResultChannels?: boolean;
}): Promise<MetaInsightRow[]> {
  const accountId = params.adAccountId.startsWith("act_")
    ? params.adAccountId
    : `act_${params.adAccountId.replace(/\D/g, "")}`;

  const allRows: MetaInsightRow[] = [];
  let nextUrl: string | null = null;

  const buildUrl = () => {
    const url = new URL(`${metaGraphBase()}/${accountId}/insights`);
    // Campaign level matches Ads Manager campaign totals / manual CSV exports that
    // aren't broken out by ad set. Ad-set level double-counts leads when the same
    // conversion is attributed across multiple ad sets in one campaign (Credit Firm).
    url.searchParams.set("level", params.level ?? "campaign");
    url.searchParams.set("time_increment", "1");
    const fields = params.includeResultChannels === false
      ? META_INSIGHT_FIELDS.split(",").filter(field => !["results", "cost_per_result", "objective_results", "cost_per_objective_result"].includes(field)).join(",")
      : META_INSIGHT_FIELDS;
    url.searchParams.set("fields", fields);
    url.searchParams.set(
      "time_range",
      JSON.stringify({ since: params.sinceIso, until: params.untilIso }),
    );
    url.searchParams.set("limit", "250");
    url.searchParams.set("use_unified_attribution_setting", "true");
    url.searchParams.set("action_report_time", "impression");
    url.searchParams.set("access_token", params.accessToken);
    return url.toString();
  };

  nextUrl = buildUrl();

  const visited = new Set<string>();
  while (nextUrl) {
    if (visited.has(nextUrl) || visited.size >= 2000) throw new MetaInsightsFetchError({ message: "Meta pagination did not finish. Try a shorter reporting period." });
    visited.add(nextUrl);
    const data = await fetchMetaInsightsPageWithRetry(nextUrl, params.accessToken);
    allRows.push(...(data.data ?? []));
    nextUrl = data.paging?.next ?? null;
  }

  return allRows;
}

function proactiveInsightsChunkDays(level: MetaInsightsLevel): number {
  // Ad-set rows are heavier (more rows × rich action/result fields) — smaller windows avoid Vercel timeouts.
  return level === "adset" ? 5 : 7;
}

/** One date window: paginated fetch with Meta code-1 retry, then weekly sub-chunks if still failing. */
async function fetchMetaAdAccountInsightsForRangeResilient(params: {
  accessToken: string;
  adAccountId: string;
  sinceIso: string;
  untilIso: string;
  level: MetaInsightsLevel;
  includeResultChannels?: boolean;
}): Promise<MetaInsightRow[]> {
  try {
    return await fetchMetaAdAccountInsightsForRange(params);
  } catch (err) {
    if (!(err instanceof MetaInsightsFetchError) || err.meta.code !== 1) {
      throw err;
    }

    const chunks = splitIsoDateRangeIntoChunks(params.sinceIso, params.untilIso, 7);
    if (chunks.length <= 1) {
      throw err;
    }

    const allRows: MetaInsightRow[] = [];
    for (const chunk of chunks) {
      allRows.push(
        ...(await fetchMetaAdAccountInsightsForRange({ ...params, ...chunk })),
      );
    }
    return allRows;
  }
}

/** Fetches daily insights for an ad account (paginated, retried, chunked on Meta code 1). */
export async function fetchMetaAdAccountInsights(params: {
  accessToken: string;
  adAccountId: string;
  sinceIso: string;
  untilIso: string;
  /** Default campaign — matches Ads Manager totals; adset over-counts shared conversions. */
  level?: MetaInsightsLevel;
  /** Strict wizard imports use only the canonical actions channel for conversion counts. */
  includeResultChannels?: boolean;
}): Promise<MetaInsightRow[]> {
  const level = params.level ?? "campaign";
  const chunkDays = proactiveInsightsChunkDays(level);
  const chunks = splitIsoDateRangeIntoChunks(params.sinceIso, params.untilIso, chunkDays);

  if (chunks.length > 1) {
    const allRows: MetaInsightRow[] = [];
    for (const chunk of chunks) {
      allRows.push(
        ...(await fetchMetaAdAccountInsightsForRangeResilient({ ...params, ...chunk, level })),
      );
    }
    return allRows;
  }

  return fetchMetaAdAccountInsightsForRangeResilient({ ...params, level });
}

const META_CAMPAIGN_PERIOD_REACH_FIELDS = ["campaign_id", "campaign_name", "reach", "spend", "impressions"].join(",");

/**
 * One row per campaign for the full date range — reach matches Ads Manager
 * campaign-level totals (not additive daily breakdown).
 */
export async function fetchMetaAdAccountCampaignPeriodInsights(params: {
  accessToken: string;
  adAccountId: string;
  sinceIso: string;
  untilIso: string;
}): Promise<MetaInsightRow[]> {
  const accountId = params.adAccountId.startsWith("act_")
    ? params.adAccountId
    : `act_${params.adAccountId.replace(/\D/g, "")}`;

  const allRows: MetaInsightRow[] = [];
  let nextUrl: string | null = null;

  const buildUrl = () => {
    const url = new URL(`${metaGraphBase()}/${accountId}/insights`);
    url.searchParams.set("level", "campaign");
    url.searchParams.set("fields", META_CAMPAIGN_PERIOD_REACH_FIELDS);
    url.searchParams.set(
      "time_range",
      JSON.stringify({ since: params.sinceIso, until: params.untilIso }),
    );
    url.searchParams.set("limit", "250");
    url.searchParams.set("use_unified_attribution_setting", "true");
    url.searchParams.set("action_report_time", "impression");
    url.searchParams.set("access_token", params.accessToken);
    return url.toString();
  };

  nextUrl = buildUrl();

  const visited = new Set<string>();
  while (nextUrl) {
    if (visited.has(nextUrl) || visited.size >= 2000) throw new MetaInsightsFetchError({ message: "Meta pagination did not finish. Try a shorter reporting period." });
    visited.add(nextUrl);
    const data = await fetchMetaInsightsPageWithRetry(nextUrl, params.accessToken);
    allRows.push(...(data.data ?? []));
    nextUrl = data.paging?.next ?? null;
  }

  return allRows;
}

export interface MetaCustomConversion {
  id: string;
  name?: string;
}

function normalizeMetaAdAccountId(adAccountId: string): string {
  const trimmed = adAccountId.trim();
  return trimmed.startsWith("act_") ? trimmed : `act_${trimmed}`;
}

/** Lists custom conversions for an ad account (id → human name in Ads Manager). */
export async function fetchMetaCustomConversions(
  accessToken: string,
  adAccountId: string,
): Promise<MetaCustomConversion[]> {
  const actId = normalizeMetaAdAccountId(adAccountId);
  const all: MetaCustomConversion[] = [];
  let nextUrl: string | null = `${metaGraphBase()}/${actId}/customconversions?fields=id,name&limit=100&access_token=${encodeURIComponent(accessToken)}`;

  const visited = new Set<string>();
  while (nextUrl) {
    if (visited.has(nextUrl) || visited.size >= 2000) throw new MetaInsightsFetchError({ message: "Meta pagination did not finish. Try a shorter reporting period." });
    visited.add(nextUrl);
    const res = await fetchMetaGraph(nextUrl, accessToken);
    const data = (await res.json()) as {
      data?: MetaCustomConversion[];
      paging?: { next?: string };
      error?: { message: string };
    };
    if (!res.ok || data.error) {
      throw new Error(data.error?.message ?? `Failed to fetch Meta custom conversions (${res.status})`);
    }
    all.push(...(data.data ?? []));
    nextUrl = data.paging?.next ?? null;
  }

  return all;
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
  appSecret?: string,
): MetaSignedRequestPayload | null {
  const parts = signedRequest.split(".");
  if (parts.length !== 2) return null;

  const secret = appSecret ?? requireMetaAppSecret();
  const [encodedSig, encodedPayload] = parts;
  const sig = base64UrlDecode(encodedSig);
  const expected = createHmac("sha256", secret).update(encodedPayload).digest();

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
