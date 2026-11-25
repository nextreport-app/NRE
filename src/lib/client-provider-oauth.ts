import {
  META_OAUTH_RETURN_COOKIE,
  safeMetaOAuthReturnTo,
} from "./meta-oauth-return";
import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "./prisma";
import { encryptMetaToken, decryptMetaToken } from "./meta-token-storage";
import {
  saveClientProvider,
  type ClientProvider,
} from "./client-provider-connections";
import { ServiceError } from "./service-error";
export const providerScopeCookie = (provider: ClientProvider) =>
  `nre_${provider}_scope`;
export async function bindProviderOAuth(
  req: NextRequest,
  res: NextResponse,
  provider: ClientProvider,
  userId: string,
  state: string,
) {
  const clientId = req.nextUrl.searchParams.get("clientId");
  if (clientId) {
    const client = await prisma.client.findFirst({
      where: { id: clientId, userId },
      select: { id: true },
    });
    if (!client)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  res.cookies.set(
    providerScopeCookie(provider),
    encryptMetaToken(JSON.stringify({ userId, state, clientId })),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    },
  );
  return res;
}
export function providerOAuthContext(
  req: NextRequest,
  provider: ClientProvider,
  userId?: string,
): { userId: string; state: string; clientId: string | null } {
  try {
    const value = JSON.parse(
      decryptMetaToken(
        req.cookies.get(providerScopeCookie(provider))?.value ?? "",
      ),
    );
    if (
      !value.userId ||
      !value.state ||
      (value.clientId !== null && typeof value.clientId !== "string") ||
      (userId && value.userId !== userId) ||
      value.state !== req.nextUrl.searchParams.get("state")
    )
      throw Error();
    return value;
  } catch {
    throw new ServiceError(
      "Invalid or expired provider connection attempt. Try connecting again.",
      400,
    );
  }
}
export function providerOAuthReturn(
  req: NextRequest,
  provider: ClientProvider,
  query: string,
) {
  let clientId: string | null = null;
  try {
    clientId = providerOAuthContext(req, provider).clientId;
  } catch {
    /* Invalid context returns only to account settings. */
  }
  const metaReturn =
    provider === "meta"
      ? safeMetaOAuthReturnTo(req.cookies.get(META_OAUTH_RETURN_COOKIE)?.value)
      : null;
  const returnToWizard =
    metaReturn &&
    (!clientId || metaReturn === `/clients/${clientId}/reports/new`);
  const url = new URL(
    returnToWizard
      ? metaReturn
      : clientId
        ? `/clients/${encodeURIComponent(clientId)}`
        : "/account",
    req.url,
  );
  const q = new URL(query, "https://nextreport.local");
  url.search = q.search;
  url.hash =
    clientId && !returnToWizard
      ? provider === "gsc"
        ? "search-console"
        : provider === "ga4"
        ? "website-analytics"
        : "provider-connections"
      : q.hash;
  return url;
}
export async function persistOAuthProvider(
  req: NextRequest,
  provider: ClientProvider,
  userId: string,
  data: Record<string, unknown>,
) {
  const context = providerOAuthContext(req, provider, userId);
  if (context.clientId)
    return saveClientProvider(userId, context.clientId, provider, data);
  if (provider === "gsc") return prisma.$transaction(async tx => {
    const inherited = {userId, providerConnections: {none: {provider: "gsc"}}};
    await tx.client.updateMany({where: inherited, data: {gscSiteUrl: null}});
    await tx.searchConsoleSnapshot.deleteMany({where: {client: inherited}});
    return tx.user.update({where: {id: userId}, data});
  });
  return prisma.user.update({ where: { id: userId }, data });
}
