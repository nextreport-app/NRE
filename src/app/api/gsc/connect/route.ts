import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { bindProviderOAuth } from "@/lib/client-provider-oauth";
import { createPkce } from "@/lib/oauth-pkce";
import {
  buildGscConnectUrl,
  GSC_STATE_COOKIE,
  isGscConfigured,
} from "@/lib/search-console/api";
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.redirect(new URL("/login", req.url));
  if (!isGscConfigured())
    return NextResponse.json(
      { error: "Search Console is not configured. Contact support." },
      { status: 503 },
    );
  const pkce = createPkce(),
    state = randomBytes(24).toString("hex");
  const response = NextResponse.redirect(
    buildGscConnectUrl(
      new URL("/api/gsc/callback", req.url).toString(),
      state,
      pkce.challenge,
    ),
  );
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 600,
    path: "/",
  };
  response.cookies.set(GSC_STATE_COOKIE, state, options);
  response.cookies.set(
    `${GSC_STATE_COOKIE}_pkce`,
    `${session.user.id}:${pkce.verifier}`,
    options,
  );
  return bindProviderOAuth(req, response, "gsc", session.user.id, state);
}
