import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildGoogleDriveConnectUrl, GOOGLE_DRIVE_OAUTH_STATE_COOKIE } from "@/lib/google-drive";

// 10 minutes is plenty for the redirect-to-Google-and-back round trip; short
// enough that a stale, never-completed attempt can't be replayed later.
const STATE_COOKIE_MAX_AGE_SECONDS = 600;

/**
 * Starts the account settings "Connect Google Drive" flow — a full-page
 * redirect to Google's own consent screen, entirely separate from NextAuth's
 * Google sign-in provider (see google-drive.ts's file header for why: this
 * lets a user connect a different Google account than the one they log into
 * NextReport with). GET (not POST) because it's a plain browser navigation —
 * a link/button doing `location.href = "/api/google-drive/connect"`, not a
 * fetch-and-handle-response call.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.redirect(new URL("/login", req.url));

  const state = randomBytes(24).toString("hex");
  const redirectUri = new URL("/api/google-drive/callback", req.url).toString();
  const authUrl = buildGoogleDriveConnectUrl(redirectUri, state);

  const res = NextResponse.redirect(authUrl);
  res.cookies.set(GOOGLE_DRIVE_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: STATE_COOKIE_MAX_AGE_SECONDS,
    path: "/",
  });
  return res;
}
