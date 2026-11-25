import { createHash } from "node:crypto";
import { prisma } from "../prisma";
import { ServiceError } from "../service-error";
import { decryptMetaToken, isEncryptedMetaToken } from "../meta-token-storage";
import {
  resolveClientUser,
  clientProviderGuard,
} from "../client-provider-connections";
import { getSubscriptionStatus } from "../subscription";
import { refreshGscToken, queryGsc } from "./api";
import { gscPeriods, parseGscSnapshot, type GscSnapshot } from "./model";
import type { WebsiteRange } from "../website-dashboard/range";
export async function gscContext(userId: string, clientId: string) {
  const client = await prisma.client.findFirst({
    where: { id: clientId, userId },
    include: { user: true },
  });
  if (!client) throw new ServiceError("Not found", 404);
  const user = await resolveClientUser(client.user, client);
  return { client, user };
}
export function gscConnectionKey(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
export function gscGrantWhere(
  user: object & { gscRefreshToken: string | null },
  userId: string,
) {
  const scoped = clientProviderGuard(user, "gsc");
  return {
    userId,
    ...(scoped
      ? { providerConnections: { some: { ...scoped, provider: "gsc" } } }
      : {
          providerConnections: { none: { provider: "gsc" } },
          user: { gscRefreshToken: user.gscRefreshToken, gscEnabled: true },
        }),
  };
}
export async function gscAccess(user: {
  gscEnabled: boolean;
  gscRefreshToken: string | null;
}) {
  if (!user.gscEnabled || !user.gscRefreshToken)
    throw new ServiceError(
      "Connect Search Console in this client’s Connections section first.",
      400,
    );
  if (!isEncryptedMetaToken(user.gscRefreshToken))
    throw new ServiceError("Reconnect Search Console in Connections.", 409);
  let token: string;
  try {
    token = decryptMetaToken(user.gscRefreshToken);
  } catch {
    throw new ServiceError(
      "Search Console credentials could not be read. Choose the Google login again in Connections.",
      409,
    );
  }
  try {
    return (await refreshGscToken(token)).access_token;
  } catch (e) {
    if (e instanceof ServiceError) throw e;
    throw new ServiceError(
      "Search Console authorization could not be refreshed. Try again or choose the Google login again in Connections.",
      502,
    );
  }
}
export async function fetchGscSnapshot(
  token: string,
  site: string,
  selection: WebsiteRange,
  now = new Date(),
): Promise<GscSnapshot> {
  const periods = gscPeriods(selection, now);
  const specs = [
    { range: periods.current, dimension: [], limit: 1 },
    { range: periods.previous, dimension: [], limit: 1 },
    { range: periods.current, dimension: ["date"], limit: 100 },
    { range: periods.current, dimension: ["query"], limit: 20 },
    { range: periods.current, dimension: ["page"], limit: 20 },
    { range: periods.current, dimension: ["country"], limit: 10 },
    { range: periods.current, dimension: ["device"], limit: 10 },
  ];
  const results: Awaited<ReturnType<typeof queryGsc>>[] = [];
  for (let i = 0; i < specs.length; i += 3) {
    const batch = await Promise.all(
      specs
        .slice(i, i + 3)
        .map((s) =>
          queryGsc(
            token,
            site,
            s.range.startIso,
            s.range.endIso,
            s.dimension,
            s.limit,
          ),
        ),
    );
    results.push(...batch);
  }
  const normalized = (r: (typeof results)[number][number] | undefined) => ({
    clicks: r?.clicks ?? 0,
    impressions: r?.impressions ?? 0,
    ctr: r?.impressions ? r.ctr : null,
    position: r?.impressions && r.position > 0 ? r.position : null,
  });
  const list = (index: number) =>
    results[index].map((r) => ({ name: r.keys![0], ...normalized(r) }));
  const snapshot = {
    version: 1 as const,
    siteUrl: site,
    checkedAt: now.toISOString(),
    days: periods.days,
    rangeKey: periods.rangeKey,
    currentPeriod: periods.current,
    previousPeriod: periods.previous,
    current: normalized(results[0][0]),
    previous: normalized(results[1][0]),
    trend: list(2).sort((a, b) => a.name.localeCompare(b.name)),
    queries: list(3),
    pages: list(4),
    countries: list(5),
    devices: list(6),
    empty: !results[0].length || results[0][0].impressions === 0,
  };
  for (const rows of [
    snapshot.trend,
    snapshot.queries,
    snapshot.pages,
    snapshot.countries,
    snapshot.devices,
  ])
    if (new Set(rows.map((r) => r.name)).size !== rows.length)
      throw new ServiceError(
        "Search Console returned duplicate report rows. Retry shortly.",
        502,
      );
  for (const row of snapshot.trend)
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(row.name) ||
      row.name < periods.current.startIso ||
      row.name > periods.current.endIso
    )
      throw new ServiceError(
        "Search Console returned an invalid daily report.",
        502,
      );
  return snapshot;
}
export async function refreshGscDashboard(
  userId: string,
  clientId: string,
  selection: WebsiteRange,
  now = new Date(),
) {
  const { client, user } = await gscContext(userId, clientId);
  if (getSubscriptionStatus(user).isBlocked || !user.emailVerified)
    throw new ServiceError(
      "An active account with a verified email is required.",
      403,
    );
  const site = client.gscSiteUrl;
  if (!site)
    throw new ServiceError(
      "Choose this client’s Search Console site in Connections first.",
      400,
    );
  if (!user.gscEnabled || !user.gscRefreshToken)
    throw new ServiceError("Connect Search Console in Connections first.", 400);
  const periods = gscPeriods(selection, now),
    days = typeof selection === "number" ? selection : 0,
    key = gscConnectionKey(user.gscRefreshToken);
  const record = await prisma.searchConsoleSnapshot.upsert({
    where: { clientId_days: { clientId, days } },
    create: {
      clientId,
      days,
      siteUrl: site,
      rangeKey: periods.rangeKey,
      connectionKey: key,
    },
    update: {},
  });
  const same =
    record.siteUrl === site &&
    record.rangeKey === periods.rangeKey &&
    record.connectionKey === key;
  if (
    same &&
    record.lastAttemptAt &&
    now.getTime() - record.lastAttemptAt.getTime() < 300000
  ) {
    const previous = parseGscSnapshot(record.dataJson, site);
    if (
      !record.error &&
      previous?.currentPeriod.endIso === periods.current.endIso
    )
      return { cached: true };
    throw new ServiceError(
      "Search Console was checked recently. Retry in five minutes.",
      429,
      300,
    );
  }
  const claim = await prisma.searchConsoleSnapshot.updateMany({
    where: {
      id: record.id,
      OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }],
      AND: [
        {
          OR: [
            { lastAttemptAt: null },
            { lastAttemptAt: { lte: new Date(now.getTime() - 300000) } },
            { rangeKey: { not: periods.rangeKey } },
            { siteUrl: { not: site } },
            { connectionKey: { not: key } },
          ],
        },
      ],
    },
    data: {
      siteUrl: site,
      connectionKey: key,
      rangeKey: periods.rangeKey,
      lastAttemptAt: now,
      leaseUntil: new Date(now.getTime() + 120000),
      error: null,
      ...(!same ? { dataJson: null, checkedAt: null } : {}),
    },
  });
  if (!claim.count)
    throw new ServiceError(
      "A Search Console refresh is already running. Try again shortly.",
      429,
      60,
    );
  const where = {
    id: record.id,
    siteUrl: site,
    connectionKey: key,
    rangeKey: periods.rangeKey,
    lastAttemptAt: now,
    client: { ...gscGrantWhere(user, userId), gscSiteUrl: site },
  };
  try {
    const token = await gscAccess(user);
    const data = await fetchGscSnapshot(token, site, selection, now);
    const saved = await prisma.searchConsoleSnapshot.updateMany({
      where,
      data: {
        dataJson: JSON.stringify(data),
        checkedAt: now,
        error: null,
        leaseUntil: null,
      },
    });
    if (!saved.count)
      throw new ServiceError(
        "The site or connection changed during refresh. Reload and try again.",
        409,
      );
    return { cached: false };
  } catch (e) {
    const message =
      e instanceof ServiceError
        ? e.message
        : "Search Console could not load this date range. Retry shortly; saved figures have not been refreshed.";
    await prisma.searchConsoleSnapshot.updateMany({
      where,
      data: { error: message, leaseUntil: null },
    });
    throw new ServiceError(
      message,
      e instanceof ServiceError ? e.status : 502,
      e instanceof ServiceError ? e.retryAfter : undefined,
    );
  }
}
