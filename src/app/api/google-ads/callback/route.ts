import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  exchangeGoogleAdsAuthCode,
  fetchGoogleAdsAccountEmail,
  GOOGLE_ADS_OAUTH_STATE_COOKIE,
} from "@/lib/google-ads-api";

function redirectToAccount(req: NextRequest, query: string) {
  return NextResponse.redirect(new URL(`/account${query}`, req.url));
}

/** Completes the "Connect Google Ads" OAuth flow started by /api/google-ads/connect. */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.redirect(new URL("/login", req.url));

  const url = new URL(req.url);
  const expectedState = req.cookies.get(GOOGLE_ADS_OAUTH_STATE_COOKIE)?.value;

  const clearStateCookie = (res: NextResponse) => {
    res.cookies.set(GOOGLE_ADS_OAUTH_STATE_COOKIE, "", { maxAge: 0, path: "/" });
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

  const code = url.searchParams.get("code");
  if (!code) {
    return clearStateCookie(redirectToAccount(req, "?google_ads_error=missing_code"));
  }

  try {
    const redirectUri = new URL("/api/google-ads/callback", req.url).toString();
    const tokens = await exchangeGoogleAdsAuthCode(code, redirectUri);

    if (!tokens.refresh_token) {
      return clearStateCookie(redirectToAccount(req, "?google_ads_error=no_refresh_token"));
    }

    const email = await fetchGoogleAdsAccountEmail(tokens.access_token);

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        googleAdsEnabled: true,
        googleAdsAccessToken: tokens.access_token,
        googleAdsRefreshToken: tokens.refresh_token,
        googleAdsConnectedEmail: email,
      },
    });

    return clearStateCookie(redirectToAccount(req, "?google_ads_connected=1#google-ads"));
  } catch (err) {
    console.error("[api:google-ads:callback] failed:", err);
    return clearStateCookie(redirectToAccount(req, "?google_ads_error=connection_failed"));
  }
}
