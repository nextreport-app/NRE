import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  exchangeGa4AuthCode,
  fetchGa4AccountEmail,
  GA4_OAUTH_STATE_COOKIE,
} from "@/lib/ga4-api";

function redirectToAccount(req: NextRequest, query: string) {
  return NextResponse.redirect(new URL(`/account${query}`, req.url));
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.redirect(new URL("/login", req.url));

  const url = new URL(req.url);
  const expectedState = req.cookies.get(GA4_OAUTH_STATE_COOKIE)?.value;

  const clearStateCookie = (res: NextResponse) => {
    res.cookies.set(GA4_OAUTH_STATE_COOKIE, "", { maxAge: 0, path: "/" });
    return res;
  };

  const oauthError = url.searchParams.get("error");
  if (oauthError) {
    return clearStateCookie(redirectToAccount(req, `?ga4_error=${encodeURIComponent(oauthError)}`));
  }

  const state = url.searchParams.get("state");
  if (!state || !expectedState || state !== expectedState) {
    return clearStateCookie(redirectToAccount(req, "?ga4_error=invalid_state"));
  }

  const code = url.searchParams.get("code");
  if (!code) {
    return clearStateCookie(redirectToAccount(req, "?ga4_error=missing_code"));
  }

  try {
    const redirectUri = new URL("/api/ga4/callback", req.url).toString();
    const tokens = await exchangeGa4AuthCode(code, redirectUri);

    if (!tokens.refresh_token) {
      return clearStateCookie(redirectToAccount(req, "?ga4_error=no_refresh_token"));
    }

    const email = await fetchGa4AccountEmail(tokens.access_token);

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        ga4Enabled: true,
        ga4AccessToken: tokens.access_token,
        ga4RefreshToken: tokens.refresh_token,
        ga4ConnectedEmail: email,
      },
    });

    return clearStateCookie(redirectToAccount(req, "?ga4_connected=1#ga4"));
  } catch (err) {
    console.error("[api:ga4:callback] failed:", err);
    return clearStateCookie(redirectToAccount(req, "?ga4_error=connection_failed"));
  }
}
