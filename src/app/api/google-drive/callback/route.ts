import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  exchangeGoogleAuthCode,
  fetchGoogleAccountEmail,
  GOOGLE_DRIVE_OAUTH_STATE_COOKIE,
} from "@/lib/google-drive";

function redirectToAccount(req: NextRequest, query: string) {
  return NextResponse.redirect(new URL(`/account${query}`, req.url));
}

/** Completes the "Connect Google Drive" flow started by /api/google-drive/connect — see that route's comment for why this isn't NextAuth's own Google callback. */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.redirect(new URL("/login", req.url));

  const url = new URL(req.url);
  const expectedState = req.cookies.get(GOOGLE_DRIVE_OAUTH_STATE_COOKIE)?.value;

  // Always clear the one-time state cookie on the way out, success or not —
  // it's only ever valid for a single round trip.
  const clearStateCookie = (res: NextResponse) => {
    res.cookies.set(GOOGLE_DRIVE_OAUTH_STATE_COOKIE, "", { maxAge: 0, path: "/" });
    return res;
  };

  const oauthError = url.searchParams.get("error");
  if (oauthError) {
    return clearStateCookie(redirectToAccount(req, `?google_drive_error=${encodeURIComponent(oauthError)}`));
  }

  const state = url.searchParams.get("state");
  if (!state || !expectedState || state !== expectedState) {
    return clearStateCookie(redirectToAccount(req, "?google_drive_error=invalid_state"));
  }

  const code = url.searchParams.get("code");
  if (!code) {
    return clearStateCookie(redirectToAccount(req, "?google_drive_error=missing_code"));
  }

  try {
    const redirectUri = new URL("/api/google-drive/callback", req.url).toString();
    const tokens = await exchangeGoogleAuthCode(code, redirectUri);

    // access_type=offline + prompt=consent (see buildGoogleDriveConnectUrl)
    // guarantee a refresh_token on every connect — if it's still somehow
    // missing, there's no way to call the Drive API later outside this
    // request, so treat it as a failed connection rather than silently
    // storing a connection that can never actually auto-save anything.
    if (!tokens.refresh_token) {
      return clearStateCookie(redirectToAccount(req, "?google_drive_error=no_refresh_token"));
    }

    const email = await fetchGoogleAccountEmail(tokens.access_token);

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        googleAccessToken: tokens.access_token,
        googleRefreshToken: tokens.refresh_token,
        googleConnectedEmail: email,
      },
    });

    return clearStateCookie(redirectToAccount(req, "?google_drive_connected=1"));
  } catch (err) {
    console.error("[api:google-drive:callback] failed:", err);
    return clearStateCookie(redirectToAccount(req, "?google_drive_error=connection_failed"));
  }
}
