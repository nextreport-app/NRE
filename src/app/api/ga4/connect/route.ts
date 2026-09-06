import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildGa4ConnectUrl, GA4_OAUTH_STATE_COOKIE, isGa4OAuthConfigured } from "@/lib/ga4-api";

const STATE_COOKIE_MAX_AGE_SECONDS = 600;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.redirect(new URL("/login", req.url));

  if (!isGa4OAuthConfigured()) {
    return NextResponse.redirect(new URL("/account?ga4_error=not_configured", req.url));
  }

  const state = randomBytes(24).toString("hex");
  const redirectUri = new URL("/api/ga4/callback", req.url).toString();
  const res = NextResponse.redirect(buildGa4ConnectUrl(redirectUri, state));
  res.cookies.set(GA4_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: STATE_COOKIE_MAX_AGE_SECONDS,
    path: "/",
  });
  return res;
}
