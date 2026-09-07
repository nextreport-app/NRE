import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildTikTokConnectUrl, isTikTokOAuthConfigured, TIKTOK_OAUTH_STATE_COOKIE } from "@/lib/tiktok-api";

const STATE_COOKIE_MAX_AGE_SECONDS = 600;

/** Starts the account settings "Connect TikTok Ads" OAuth flow. */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.redirect(new URL("/login", req.url));

  if (!isTikTokOAuthConfigured()) {
    return NextResponse.redirect(new URL("/account?tiktok_ads_error=not_configured", req.url));
  }

  const state = randomBytes(24).toString("hex");
  const redirectUri = new URL("/api/tiktok/callback", req.url).toString();
  const authUrl = buildTikTokConnectUrl(redirectUri, state);

  const res = NextResponse.redirect(authUrl);
  res.cookies.set(TIKTOK_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: STATE_COOKIE_MAX_AGE_SECONDS,
    path: "/",
  });
  return res;
}
