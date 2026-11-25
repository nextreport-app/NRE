import { z } from "zod";
import { ServiceError } from "../service-error";
export const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
export const GSC_STATE_COOKIE = "gsc_oauth_state";
function oauthConfig() {
  for (const prefix of ["GSC", "GA4", "GOOGLE_ADS"]) {
    const id = process.env[`${prefix}_CLIENT_ID`]?.trim(),
      secret = process.env[`${prefix}_CLIENT_SECRET`]?.trim();
    if (id || secret) {
      if (id && secret) return { id, secret };
      throw new ServiceError(
        "Search Console OAuth configuration is incomplete. Contact support.",
        503,
      );
    }
  }
  throw new ServiceError(
    "Search Console is not configured. Contact NextReport support.",
    503,
  );
}
export function isGscConfigured() {
  try {
    oauthConfig();
    return true;
  } catch {
    return false;
  }
}
export function buildGscConnectUrl(
  redirect: string,
  state: string,
  challenge: string,
) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: oauthConfig().id,
    redirect_uri: redirect,
    response_type: "code",
    scope: `${GSC_SCOPE} openid email`,
    access_type: "offline",
    prompt: "consent select_account",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();
  return url.toString();
}
export async function gscError(response: Response): Promise<never> {
  const raw = await response.json().catch(() => null);
  const reason =
    Array.isArray(raw?.error?.details) &&
    raw.error.details.some(
      (d: { reason?: string }) => d?.reason === "SERVICE_DISABLED",
    );
  const errors = Array.isArray(raw?.error?.errors) ? raw.error.errors : [];
  const details = Array.isArray(raw?.error?.details) ? raw.error.details : [];
  const quota = [...errors, ...details].some((entry: { reason?: string }) =>
    /^(userRateLimitExceeded|rateLimitExceeded|dailyLimitExceeded|quotaExceeded|QUOTA_EXCEEDED|RATE_LIMIT_EXCEEDED)$/i.test(
      entry?.reason ?? "",
    ),
  );
  if (quota && !reason && response.status !== 429)
    throw new ServiceError(
      `Search Console has temporarily limited requests. Wait a few minutes and retry. (GSC_QUOTA_${response.status})`,
      429,
      300,
    );
  const message = reason
    ? "Search Console API is disabled for NextReport’s Google Cloud project. Contact support; changing the site will not fix it."
    : raw?.error === "invalid_grant" || response.status === 401
      ? "Search Console authorization expired or was revoked. Choose the Google login again in Connections."
      : raw?.error === "invalid_client"
        ? "NextReport’s Search Console OAuth configuration needs attention. Contact support."
        : response.status === 403
          ? "Google denied Search Console access. Check that this Google login has permission for the selected site and granted read-only Search Console access."
          : response.status === 429
            ? "Search Console has temporarily limited requests. Wait a few minutes and retry."
            : response.status === 404
              ? "This Search Console site is no longer available to the connected Google login. Choose an accessible site in Client settings."
              : response.status >= 500
                ? "Google Search Console is temporarily unavailable. Retry shortly."
                : "Search Console could not complete this request. Contact support with the error code.";
  throw new ServiceError(
    `${message} (GSC_HTTP_${response.status})`,
    response.status === 429 ? 429 : 502,
    response.status === 429 ? 300 : undefined,
  );
}
const tokensSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().optional(),
  scope: z.string().optional(),
});
async function tokenRequest(values: Record<string, string>) {
  const config = oauthConfig();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: config.id,
      client_secret: config.secret,
      ...values,
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) return gscError(response);
  return tokensSchema.parse(await response.json());
}
export const exchangeGscCode = (
  code: string,
  redirect: string,
  verifier: string,
) =>
  tokenRequest({
    code,
    redirect_uri: redirect,
    code_verifier: verifier,
    grant_type: "authorization_code",
  });
export const refreshGscToken = (refresh_token: string) =>
  tokenRequest({ refresh_token, grant_type: "refresh_token" });
export async function gscEmail(token: string) {
  const response = await fetch(
    "https://openidconnect.googleapis.com/v1/userinfo",
    {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!response.ok) return null;
  return (
    z
      .object({ email: z.string().email().optional() })
      .parse(await response.json()).email ?? null
  );
}
export const gscSiteSchema = z
  .string()
  .max(2048)
  .refine((value) => {
    if (value.startsWith("sc-domain:")) {
      const domain = value.slice(10);
      if (!domain || /[\s/:@?#%]/u.test(domain)) return false;
      try {
        return new URL(`https://${domain}`).hostname.includes(".");
      } catch {
        return false;
      }
    }
    try {
      const url = new URL(value);
      return (
        ["https:", "http:"].includes(url.protocol) &&
        !url.username &&
        !url.password &&
        !url.search &&
        !url.hash
      );
    } catch {
      return false;
    }
  }, "Choose a valid Search Console site.");
export async function listGscSites(token: string) {
  const response = await fetch(
    "https://www.googleapis.com/webmasters/v3/sites",
    {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20000),
      cache: "no-store",
    },
  );
  if (!response.ok) return gscError(response);
  const data = z
    .object({
      siteEntry: z
        .array(
          z.object({ siteUrl: gscSiteSchema, permissionLevel: z.string() }),
        )
        .optional(),
    })
    .parse(await response.json());
  return (data.siteEntry ?? []).filter((site) =>
    ["siteOwner", "siteFullUser", "siteRestrictedUser"].includes(
      site.permissionLevel,
    ),
  );
}
export const gscMetricsSchema = z.object({
  clicks: z.number().finite().nonnegative(),
  impressions: z.number().finite().nonnegative(),
  ctr: z.number().finite().min(0).max(1),
  position: z.number().finite().nonnegative(),
});
export async function queryGsc(
  token: string,
  site: string,
  startDate: string,
  endDate: string,
  dimensions: string[],
  rowLimit: number,
) {
  const response = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startDate,
        endDate,
        dimensions,
        rowLimit,
        type: "web",
        dataState: "final",
      }),
      signal: AbortSignal.timeout(20000),
      cache: "no-store",
    },
  );
  if (!response.ok) return gscError(response);
  const data = z
    .object({
      rows: z
        .array(
          gscMetricsSchema.extend({ keys: z.array(z.string()).optional() }),
        )
        .optional(),
    })
    .parse(await response.json());
  const rows = data.rows ?? [];
  if (rows.length > rowLimit)
    throw new ServiceError(
      "Search Console returned an invalid report size.",
      502,
    );
  if (
    rows.some((row) =>
      dimensions.length
        ? row.keys?.length !== dimensions.length
        : !!row.keys?.length,
    )
  )
    throw new ServiceError(
      "Search Console returned incomplete report dimensions.",
      502,
    );
  if (!dimensions.length && rows.length > 1)
    throw new ServiceError(
      "Search Console returned invalid report totals.",
      502,
    );
  return rows;
}
