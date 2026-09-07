import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { exchangeTikTokAuthCode, fetchTikTokAdvertisers, TIKTOK_OAUTH_STATE_COOKIE } from "@/lib/tiktok-api";

function redirectToAccount(req: NextRequest, query: string) {
  return NextResponse.redirect(new URL(`/account${query}`, req.url));
}

/** Completes the "Connect TikTok Ads" OAuth flow started by /api/tiktok/connect. */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.redirect(new URL("/login", req.url));

  const url = new URL(req.url);
  const expectedState = req.cookies.get(TIKTOK_OAUTH_STATE_COOKIE)?.value;

  const clearStateCookie = (res: NextResponse) => {
    res.cookies.set(TIKTOK_OAUTH_STATE_COOKIE, "", { maxAge: 0, path: "/" });
    return res;
  };

  const oauthError = url.searchParams.get("error");
  if (oauthError) {
    return clearStateCookie(redirectToAccount(req, `?tiktok_ads_error=${encodeURIComponent(oauthError)}`));
  }

  const state = url.searchParams.get("state");
  if (!state || !expectedState || state !== expectedState) {
    return clearStateCookie(redirectToAccount(req, "?tiktok_ads_error=invalid_state"));
  }

  const authCode = url.searchParams.get("auth_code") ?? url.searchParams.get("code");
  if (!authCode) {
    return clearStateCookie(redirectToAccount(req, "?tiktok_ads_error=missing_code"));
  }

  try {
    const tokenData = await exchangeTikTokAuthCode(authCode);
    const expiresIn = tokenData.expires_in ?? 86400;
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

    let advertiserIds = tokenData.advertiser_ids ?? [];
    let connectedName: string | null = null;

    try {
      const advertisers = await fetchTikTokAdvertisers(tokenData.access_token);
      if (advertisers.length > 0) {
        advertiserIds = advertisers.map((a) => a.advertiser_id);
        connectedName = advertisers[0]?.advertiser_name ?? null;
      }
    } catch {
      // OAuth response advertiser_ids is enough for v1.
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        tiktokAdsEnabled: true,
        tiktokAccessToken: tokenData.access_token,
        tiktokRefreshToken: tokenData.refresh_token ?? null,
        tiktokTokenExpiresAt: tokenExpiresAt,
        tiktokConnectedName: connectedName,
        tiktokAdvertiserIds: advertiserIds.length > 0 ? JSON.stringify(advertiserIds) : null,
      },
    });

    return clearStateCookie(redirectToAccount(req, "?tiktok_ads_connected=1"));
  } catch (err) {
    console.error("[api:tiktok:callback] failed:", err);
    return clearStateCookie(redirectToAccount(req, "?tiktok_ads_error=connection_failed"));
  }
}
