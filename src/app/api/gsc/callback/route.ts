import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  providerOAuthContext,
  providerOAuthReturn,
  providerScopeCookie,
  persistOAuthProvider,
} from "@/lib/client-provider-oauth";
import { encryptMetaToken } from "@/lib/meta-token-storage";
import {
  exchangeGscCode,
  gscEmail,
  GSC_STATE_COOKIE,
  GSC_SCOPE,
} from "@/lib/search-console/api";
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.redirect(new URL("/login", req.url));
  const finish = (query: string) => {
    const response = NextResponse.redirect(
      providerOAuthReturn(req, "gsc", query),
    );
    for (const cookie of [
      GSC_STATE_COOKIE,
      `${GSC_STATE_COOKIE}_pkce`,
      providerScopeCookie("gsc"),
    ])
      response.cookies.set(cookie, "", { maxAge: 0, path: "/" });
    return response;
  };
  try {
    providerOAuthContext(req, "gsc", session.user.id);
    const state = req.nextUrl.searchParams.get("state"),
      pkce = req.cookies.get(`${GSC_STATE_COOKIE}_pkce`)?.value;
    if (
      !state ||
      state !== req.cookies.get(GSC_STATE_COOKIE)?.value ||
      !pkce?.startsWith(`${session.user.id}:`)
    )
      return finish("?gsc_error=invalid_state");
    if (req.nextUrl.searchParams.has("error"))
      return finish("?gsc_error=consent_declined");
    const code = req.nextUrl.searchParams.get("code");
    if (!code) return finish("?gsc_error=missing_code");
    const tokens = await exchangeGscCode(
      code,
      new URL("/api/gsc/callback", req.url).toString(),
      pkce.slice(session.user.id.length + 1),
    );
    if (
      !tokens.refresh_token ||
      (tokens.scope && !tokens.scope.split(" ").includes(GSC_SCOPE))
    )
      return finish("?gsc_error=missing_permission");
    const email = await gscEmail(tokens.access_token);
    await persistOAuthProvider(req, "gsc", session.user.id, {
      gscEnabled: true,
      gscRefreshToken: encryptMetaToken(tokens.refresh_token),
      gscConnectedEmail: email,
    });
    return finish("?gsc_connected=1#search-console");
  } catch {
    return finish("?gsc_error=connection_failed");
  }
}
