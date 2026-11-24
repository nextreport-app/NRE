import { prisma } from "./prisma";
import {
  encryptMetaToken,
  decryptMetaToken,
  isEncryptedMetaToken,
} from "./meta-token-storage";
import { ServiceError } from "./service-error";
import type { Prisma } from "@/generated/prisma/client";
export const providerKeys = [
  "ga4",
  "meta",
  "google-ads",
  "tiktok",
  "google-drive",
] as const;
export type ClientProvider = (typeof providerKeys)[number];
const prefixes: Record<ClientProvider, string> = {
  ga4: "ga4",
  meta: "meta",
  "google-ads": "googleAds",
  tiktok: "tiktok",
  "google-drive": "google",
};
const scopes = Symbol("client-provider-scopes");
type Scope = {
  id: string;
  credentials: string;
  values: Record<string, unknown>;
};
type Scoped = { [scopes]?: Partial<Record<ClientProvider, Scope>> };
export type ConnectionClient = {
  id: string;
  userId: string;
  hasProviderConnections?: boolean;
};
export function providerOf(data: Record<string, unknown>): ClientProvider {
  const key = Object.keys(data)[0] ?? "";
  const provider = providerKeys.find((p) => key.startsWith(prefixes[p]));
  if (
    !provider ||
    Object.keys(data).some((k) => !k.startsWith(prefixes[provider]))
  )
    throw new ServiceError("Invalid provider credential update.", 400);
  return provider;
}
function unavailable(provider: ClientProvider): Record<string, unknown> {
  const prefix=prefixes[provider];
  return { [`${prefix}${provider === "meta" || provider === "tiktok" ? "AdsEnabled" : provider === "google-drive" ? "DriveEnabled" : "Enabled"}`]: false,
    [`${prefix}AccessToken`]: null, [`${prefix}RefreshToken`]: null,
    [`${prefix}ConnectedEmail`]: null, [`${prefix}ConnectedName`]: null,
    ...(provider === "meta" ? {metaConnectedUserId:null} : {}) };
}
function decode(credentials: string): Record<string, unknown> {
  if (!isEncryptedMetaToken(credentials))
    throw new ServiceError("Reconnect this client’s provider connection.", 409);
  const values = JSON.parse(decryptMetaToken(credentials));
  for (const key of ["metaTokenExpiresAt", "tiktokTokenExpiresAt"])
    if (values[key]) values[key] = new Date(values[key]);
  return values;
}
/** Only resolve after validating client ownership. Never expose this effective user as page props. */
export async function resolveClientUser<T extends object | null>(
  user: T,
  client: ConnectionClient,
): Promise<T> {
  if (!user || !client.hasProviderConnections) return user;
  const rows = await prisma.clientProviderConnection.findMany({
    where: { clientId: client.id, client: { userId: client.userId } },
  });
  const resolved = { ...user } as T & Scoped;
  const metadata: Scoped[typeof scopes] = {};
  for (const row of rows) {
    if (!providerKeys.includes(row.provider as ClientProvider)) continue;
    const provider = row.provider as ClientProvider;
    let values: Record<string,unknown>;
    try { values=decode(row.credentials); if(providerOf(values)!==provider) throw Error(); }
    catch { values=unavailable(provider); }
    // A damaged override stays disconnected; it must never inherit another identity's tokens.

    Object.assign(resolved, values);
    metadata[provider] = { id: row.id, credentials: row.credentials, values };
  }
  Object.defineProperty(resolved, scopes, { value: metadata });
  return resolved;
}
export function clientProviderIsScoped(user: object, provider: ClientProvider) {
  return !!(user as Scoped)[scopes]?.[provider];
}
/** Refresh tokens must be saved to the exact credential row they came from. No global fallback on a race. */
export async function updateResolvedProviderUser(
  args: { where: { id: string }; data: Prisma.UserUpdateInput },
  user: object,
) {
  const provider = providerOf(args.data as Record<string, unknown>),
    scope = (user as Scoped)[scopes]?.[provider];
  if (!scope) {
    const values=user as Record<string,unknown>;
    const prefix=prefixes[provider];
    const tokenKey=values[`${prefix}RefreshToken`] ? `${prefix}RefreshToken` : `${prefix}AccessToken`;
    const token=values[tokenKey];
    // A refresh started on the agency grant cannot overwrite a newly connected identity.
    return prisma.user.update({...args,where:{...args.where,...(typeof token==="string"?{[tokenKey]:token}:{})}});
  }
  const values = { ...scope.values, ...args.data };
  const credentials = encryptMetaToken(JSON.stringify(values));
  const result = await prisma.clientProviderConnection.updateMany({
    where: {
      id: scope.id,
      credentials: scope.credentials,
      client: { userId: args.where.id },
    },
    data: { credentials },
  });
  if (!result.count)
    throw new ServiceError(
      "This client's connection changed. Reload and try again.",
      409,
    );
  scope.credentials = credentials;
  scope.values = values;
  return result;
}
export async function saveClientProvider(
  userId: string,
  clientId: string,
  provider: ClientProvider,
  data: Record<string, unknown>,
) {
  if (providerOf(data) !== provider)
    throw new ServiceError("Invalid connection", 400);
  await prisma.$transaction(async (tx) => {
    const owned = await tx.client.updateMany({
      where: { id: clientId, userId },
      data: { hasProviderConnections: true },
    });
    if (!owned.count) throw new ServiceError("Not found", 404);
    await tx.clientProviderConnection.upsert({
      where: { clientId_provider: { clientId, provider } },
      create: {
        clientId,
        provider,
        externalId:
          typeof data.metaConnectedUserId === "string"
            ? data.metaConnectedUserId
            : null,
        credentials: encryptMetaToken(JSON.stringify(data)),
      },
      update: {
        externalId:
          typeof data.metaConnectedUserId === "string"
            ? data.metaConnectedUserId
            : null,
        credentials: encryptMetaToken(JSON.stringify(data)),
      },
    });
    // A different identity must explicitly choose its own assets. Never infer by name.
    if (provider === "ga4") {
      await tx.client.update({
        where: { id: clientId },
        data: { ga4PropertyId: null, ga4PropertyName: null },
      });
      await tx.websiteDashboardSnapshot.deleteMany({ where: { clientId } });
    }
    if (provider === "meta")
      await tx.client.update({
        where: { id: clientId },
        data: { metaAdAccountId: null, metaAdAccountName: null },
      });
    if (provider === "google-drive")
      await tx.client.update({
        where: { id: clientId },
        data: { lastDriveFolderId: null, lastDriveFolderName: null },
      });
  });
}
export async function resolveClientUserById<T extends object | null>(
  user: T,
  userId: string,
  clientId?: string | null,
): Promise<T> {
  if (!clientId) return user;
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, userId: true, hasProviderConnections: true },
  });
  if (!client || client.userId !== userId)
    throw new ServiceError("Not found", 404);
  return resolveClientUser(user, client);
}
export function clientProviderGuard(user: object, provider: ClientProvider) {
  const scope = (user as Scoped)[scopes]?.[provider];
  return scope ? { id: scope.id, credentials: scope.credentials } : null;
}
export async function clientProviderSummaries(
  user: object,
  client: ConnectionClient,
) {
  const effective = (await resolveClientUser(user, client)) as Record<
    string,
    unknown
  >;
  return providerKeys.map((provider) => {
    const prefix = prefixes[provider],
      scoped = clientProviderIsScoped(effective, provider);
    const label =
      effective[`${prefix}ConnectedEmail`] ??
      effective[`${prefix}ConnectedName`] ??
      null;
    const token =
      effective[`${prefix}RefreshToken`] ?? effective[`${prefix}AccessToken`];
    return {
      provider,
      scoped,
      connected: !!token,
      label: typeof label === "string" ? label : null,
    };
  });
}
