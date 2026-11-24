import { persistOAuthProvider, providerScopeCookie, providerOAuthReturn, providerOAuthContext } from "@/lib/client-provider-oauth";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  exchangeGoogleAdsAuthCode,
  fetchGoogleAdsAccountEmail,
  GOOGLE_ADS_OAUTH_STATE_COOKIE,
} from "@/lib/google-ads-api";

function redirectToAccount(req: NextRequest, query: string) {
  return NextResponse.redirect(providerOAuthReturn(req, "google-ads", query));
}

/** Completes the "Connect Google Ads" OAuth flow started by /api/google-ads/connect. */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.redirect(new URL("/login", req.url));

  const url = new URL(req.url);
  const expectedState = req.cookies.get(GOOGLE_ADS_OAUTH_STATE_COOKIE)?.value;

  const clearStateCookie = (res: NextResponse) => {
    res.cookies.set(GOOGLE_ADS_OAUTH_STATE_COOKIE, "", { maxAge: 0, path: "/" });
    res.cookies.set(`${GOOGLE_ADS_OAUTH_STATE_COOKIE}_pkce`, "", { maxAge: 0, path: "/" });
    res.cookies.set(providerScopeCookie("google-ads"), "", { maxAge: 0, path: "/" });
    return res;
  };

  const oauthError = url.searchParams.get("error");
  if (oauthError) {
    return clearStateCookie(redirectToAccount(req, `?google_ads_error=${encodeURIComponent(oauthError)}`));
  }

  const state = url.searchParams.get("state");
  if (!state || !expectedState || state !== expectedState) {
    return clearStateCookie(redirectToAccount(req, "?google_ads_error=invalid_state"));
  }

  const pkce = req.cookies.get(`${GOOGLE_ADS_OAUTH_STATE_COOKIE}_pkce`)?.value;
  const verifier = pkce?.startsWith(`${session.user.id}:`) ? pkce.slice(session.user.id.length + 1) : null;
  if (!verifier) return clearStateCookie(redirectToAccount(req, "?google_ads_error=invalid_state"));

  const code = url.searchParams.get("code");
  if (!code) {
    return clearStateCookie(redirectToAccount(req, "?google_ads_error=missing_code"));
  }

  try {
    providerOAuthContext(req, "google-ads", session.user.id);
    const redirectUri = new URL("/api/google-ads/callback", req.url).toString();
    const tokens = await exchangeGoogleAdsAuthCode(code, redirectUri, verifier);

    if (!tokens.refresh_token) {
      return clearStateCookie(redirectToAccount(req, "?google_ads_error=no_refresh_token"));
    }

    const email = await fetchGoogleAdsAccountEmail(tokens.access_token);

    await persistOAuthProvider(req, "google-ads", session.user.id, {
        googleAdsEnabled: true,
        googleAdsAccessToken: tokens.access_token,
        googleAdsRefreshToken: tokens.refresh_token,
        googleAdsConnectedEmail: email,
    });

    return clearStateCookie(redirectToAccount(req, "?google_ads_connected=1#google-ads"));
  } catch (err) {
    console.error("[api:google-ads:callback] failed:", err);
    return clearStateCookie(redirectToAccount(req, "?google_ads_error=connection_failed"));
  }
}
