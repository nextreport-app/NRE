import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildMetaConnectUrl, META_OAUTH_STATE_COOKIE } from "@/lib/meta-api";

const STATE_COOKIE_MAX_AGE_SECONDS = 600;

/** Starts the account settings "Connect Meta Ads" OAuth flow. */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.redirect(new URL("/login", req.url));

  if (!process.env.META_APP_ID?.trim() || !process.env.META_APP_SECRET?.trim()) {
    return NextResponse.redirect(new URL("/account?meta_ads_error=not_configured", req.url));
  }

  const state = randomBytes(24).toString("hex");
  const redirectUri = new URL("/api/meta/callback", req.url).toString();
  const authUrl = buildMetaConnectUrl(redirectUri, state);

  const res = NextResponse.redirect(authUrl);
  res.cookies.set(META_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: STATE_COOKIE_MAX_AGE_SECONDS,
    path: "/",
  });
  return res;
}
