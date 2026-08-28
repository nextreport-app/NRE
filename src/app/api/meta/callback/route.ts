import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  exchangeForLongLivedToken,
  exchangeMetaAuthCode,
  fetchMetaUserProfile,
  META_OAUTH_STATE_COOKIE,
} from "@/lib/meta-api";

function redirectToAccount(req: NextRequest, query: string) {
  return NextResponse.redirect(new URL(`/account${query}`, req.url));
}

/** Completes the "Connect Meta Ads" OAuth flow started by /api/meta/connect. */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.redirect(new URL("/login", req.url));

  const url = new URL(req.url);
  const expectedState = req.cookies.get(META_OAUTH_STATE_COOKIE)?.value;

  const clearStateCookie = (res: NextResponse) => {
    res.cookies.set(META_OAUTH_STATE_COOKIE, "", { maxAge: 0, path: "/" });
    return res;
  };

  const oauthError = url.searchParams.get("error");
  if (oauthError) {
    return clearStateCookie(redirectToAccount(req, `?meta_ads_error=${encodeURIComponent(oauthError)}`));
  }

  const state = url.searchParams.get("state");
  if (!state || !expectedState || state !== expectedState) {
    return clearStateCookie(redirectToAccount(req, "?meta_ads_error=invalid_state"));
  }

  const code = url.searchParams.get("code");
  if (!code) {
    return clearStateCookie(redirectToAccount(req, "?meta_ads_error=missing_code"));
  }

  try {
    const redirectUri = new URL("/api/meta/callback", req.url).toString();
    const shortLived = await exchangeMetaAuthCode(code, redirectUri);
    const longLived = await exchangeForLongLivedToken(shortLived.access_token);
    const profile = await fetchMetaUserProfile(longLived.access_token);

    const expiresIn = longLived.expires_in ?? 60 * 24 * 60 * 60;
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        metaAdsEnabled: true,
        metaAccessToken: longLived.access_token,
        metaTokenExpiresAt: tokenExpiresAt,
        metaConnectedUserId: profile.id,
        metaConnectedName: profile.name ?? null,
      },
    });

    return clearStateCookie(redirectToAccount(req, "?meta_ads_connected=1"));
  } catch (err) {
    console.error("[api:meta:callback] failed:", err);
    return clearStateCookie(redirectToAccount(req, "?meta_ads_error=connection_failed"));
  }
}
