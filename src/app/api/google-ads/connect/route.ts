import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildGoogleAdsConnectUrl, GOOGLE_ADS_OAUTH_STATE_COOKIE, isGoogleAdsOAuthConfigured } from "@/lib/google-ads-api";

const STATE_COOKIE_MAX_AGE_SECONDS = 600;

/** Starts the account settings "Connect Google Ads" OAuth flow. */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.redirect(new URL("/login", req.url));

  if (!isGoogleAdsOAuthConfigured()) {
    return NextResponse.redirect(new URL("/account?google_ads_error=not_configured", req.url));
  }

  const state = randomBytes(24).toString("hex");
  const redirectUri = new URL("/api/google-ads/callback", req.url).toString();
  const authUrl = buildGoogleAdsConnectUrl(redirectUri, state);

  const res = NextResponse.redirect(authUrl);
  res.cookies.set(GOOGLE_ADS_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: STATE_COOKIE_MAX_AGE_SECONDS,
    path: "/",
  });
  return res;
}
