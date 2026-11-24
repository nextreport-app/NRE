import { resolveClientUser, clientProviderGuard } from "@/lib/client-provider-connections";
import { type WebsiteRange, websiteRangeKey } from "./range";
import { createHash } from "node:crypto";
import { prisma } from "../prisma";
import { ServiceError } from "../service-error";
import { getSubscriptionStatus } from "../subscription";
import { refreshGa4AccessToken } from "../ga4-api";
import { fetchWebsiteSnapshot } from "./fetch";
import {
  parseWebsiteSnapshot,
  websiteSnapshotFresh,
  websitePeriods,
} from "./model";
export const websiteConnectionKey = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export async function refreshWebsiteDashboard(
  clientId: string,
  userId: string,
  selection: WebsiteRange,
  now = new Date(),
) {
  const days = websiteRangeKey(selection);
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: { user: true },
  });
  if (!client || client.userId !== userId)
    throw new ServiceError("Not found", 404);
  client.user = await resolveClientUser(client.user, client);
  if (
    getSubscriptionStatus(client.user).isBlocked ||
    !client.user.emailVerified
  )
    throw new ServiceError(
      "An active account with a verified email is required.",
      403,
    );
  const propertyId = client.ga4PropertyId,
    token = client.user.ga4RefreshToken;
  if (!propertyId || !/^\d+$/.test(propertyId))
    throw new ServiceError("Link a GA4 property on the client page first.");
  if (!client.user.ga4Enabled || !token)
    throw new ServiceError(
      "Connect Google Analytics for this client in Client settings.",
    );
  const connectionKey = websiteConnectionKey(token);
  const record = await prisma.websiteDashboardSnapshot.upsert({
    where: { clientId_days: { clientId, days } },
    create: { clientId, days, propertyId, connectionKey },
    update: {},
  });
  const same =
    record.propertyId === propertyId && record.connectionKey === connectionKey;
  const previous = same
    ? parseWebsiteSnapshot(record.dataJson, propertyId, selection)
    : null;
  if (
    same &&
    record.lastAttemptAt &&
    now.getTime() - record.lastAttemptAt.getTime() < 5 * 60000
  ) {
    if (previous && !record.error && websiteSnapshotFresh(previous, now))
      return { cached: true };
    throw new ServiceError(
      "A refresh is running or was attempted recently. Retry in five minutes.",
      429,
      300,
    );
  }
  const claim = await prisma.websiteDashboardSnapshot.updateMany({
    where: {
      id: record.id,
      OR: [
        { leaseUntil: null },
        { leaseUntil: { lte: now } },
        { propertyId: { not: propertyId } },
        { connectionKey: { not: connectionKey } },
      ],
      AND: [
        {
          OR: [
            { lastAttemptAt: null },
            { lastAttemptAt: { lte: new Date(now.getTime() - 5 * 60000) } },
            { propertyId: { not: propertyId } },
            { connectionKey: { not: connectionKey } },
          ],
        },
      ],
    },
    data: {
      propertyId,
      connectionKey,
      lastAttemptAt: now,
      leaseUntil: new Date(now.getTime() + 6 * 60000),
      error: null,
      ...(!same || (typeof selection === "object" && !previous) ? { dataJson: null, checkedAt: null } : {}),
    },
  });
  if (!claim.count)
    throw new ServiceError(
      "A refresh is already running. Try again shortly.",
      429,
      60,
    );
  const scopedGuard = clientProviderGuard(client.user, "ga4");
  const where = {
    id: record.id,
    propertyId,
    connectionKey,
    lastAttemptAt: now,
    client: {
      ga4PropertyId: propertyId,
      userId,
      ...(scopedGuard ? {providerConnections:{some:scopedGuard}} : {user: { ga4RefreshToken: token, ga4Enabled: true }}),
    },
  };
  try {
    const fresh = await refreshGa4AccessToken(token);
    const current = scopedGuard ? { count: 1 } : await prisma.user.updateMany({
      where: { id: userId, ga4RefreshToken: token, ga4Enabled: true },
      data: { ga4AccessToken: fresh.access_token },
    });
    if (!current.count)
      throw new ServiceError(
        "The GA4 connection changed during refresh. Reload and try again.",
        409,
      );
    const snapshot = await fetchWebsiteSnapshot(
      fresh.access_token,
      propertyId,
      selection,
      now,
    );
    const dataJson = JSON.stringify(snapshot);
    if (!parseWebsiteSnapshot(dataJson, propertyId, selection))
      throw new ServiceError(
        "GA4 returned incomplete dashboard data. Refresh again or check the property configuration.",
        502,
      );
    if (
      typeof selection === "number" && websitePeriods(selection, snapshot.property.timezone).currentPeriod.endIso !==
      snapshot.currentPeriod.endIso
    )
      throw new ServiceError(
        "The property calendar changed during refresh. Try again for the new day.",
        409,
      );
    const saved = await prisma.websiteDashboardSnapshot.updateMany({
      where,
      data: {
        dataJson,
        checkedAt: new Date(snapshot.checkedAt),
        error: null,
        leaseUntil: null,
      },
    });
    if (!saved.count)
      throw new ServiceError(
        "The linked property or GA4 connection changed. Reload and refresh the current property.",
        409,
      );
    return { cached: false };
  } catch (error) {
    const message =
      error instanceof ServiceError
        ? error.message
        : "GA4 refresh failed. Check your Analytics connection and property access, then retry. Prior figures are not a fresh check.";
    await prisma.websiteDashboardSnapshot.updateMany({
      where,
      data: { error: message, leaseUntil: null },
    });
    throw new ServiceError(
      message,
      error instanceof ServiceError ? error.status : 502,
    );
  }
}
