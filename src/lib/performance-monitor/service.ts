import { prisma } from "../prisma";
import { ServiceError } from "../service-error";
import { getSubscriptionStatus } from "../subscription";
import {
  ensureFreshMetaAccessToken,
  fetchMetaAdAccountMetadata,
} from "../meta-api";
import { decryptMetaToken, encryptMetaToken } from "../meta-token-storage";
import { fetchMetaReportCsv } from "../nre/meta-api-sync";
import { parseCsvText } from "../nre/parse-csv";
import {
  buildPerformanceFacts,
  performanceWindow,
  readPerformanceSnapshot,
  type PerformanceSnapshot,
} from "./facts";
import { queueEmail, deliverQueuedEmail } from "../email-delivery";
export function performanceAlertKey(clientId: string, endIso: string) {
  return `performance-alert:${clientId}:${endIso}`;
}
export async function checkClientPerformance(
  id: string,
  userId: string,
  now = new Date(),
) {
  const client = await prisma.client.findUnique({
    where: { id },
    include: { user: true },
  });
  if (!client || client.userId !== userId)
    throw new ServiceError("Not found", 404);
  if (
    getSubscriptionStatus(client.user).isBlocked ||
    !client.user.emailVerified
  ) {
    await prisma.client.updateMany({
      where: { id, userId },
      data: { performanceMonitorLastAttemptAt: now },
    });
    throw new ServiceError(
      "An active account with a verified email is required.",
      403,
    );
  }
  if (!client.performanceMonitorEnabled || !client.metaAdAccountId)
    throw new ServiceError(
      "Enable performance monitoring and link a Meta ad account first.",
    );
  const claimed = await prisma.client.updateMany({
    where: {
      id,
      userId,
      performanceMonitorEnabled: true,
      OR: [
        { performanceMonitorLeaseUntil: null },
        { performanceMonitorLeaseUntil: { lte: now } },
      ],
      AND: [
        {
          OR: [
            { performanceMonitorLastAttemptAt: null },
            {
              performanceMonitorLastAttemptAt: {
                lte: new Date(now.getTime() - 5 * 60000),
              },
            },
          ],
        },
      ],
    },
    data: {
      performanceMonitorLastAttemptAt: now,
      performanceMonitorLeaseUntil: new Date(now.getTime() + 6 * 60000),
    },
  });
  if (!claimed.count)
    throw new ServiceError(
      "A check is running or was attempted recently. Retry in five minutes.",
      429,
      300,
    );
  const config = {
    metaAdAccountId: client.metaAdAccountId,
    currency: client.currency,
    timezone: client.timezone,
  };
  const where = {
    id,
    userId,
    ...config,
    performanceMonitorEnabled: true,
    performanceMonitorLastAttemptAt: now,
  };
  let snapshot: PerformanceSnapshot;
  try {
    if (!client.user.metaAdsEnabled || !client.user.metaAccessToken)
      throw new ServiceError("Reconnect Meta Ads in Account settings.");
    const token = await ensureFreshMetaAccessToken({
      accessToken: decryptMetaToken(client.user.metaAccessToken),
      tokenExpiresAt: client.user.metaTokenExpiresAt,
    });
    if (token.refreshed)
      await prisma.user.update({
        where: { id: userId },
        data: {
          metaAccessToken: encryptMetaToken(token.accessToken),
          metaTokenExpiresAt: token.tokenExpiresAt,
        },
      });
    const account = await fetchMetaAdAccountMetadata(
      token.accessToken,
      client.metaAdAccountId,
    );
    if (
      account.currency !== client.currency ||
      account.timezone_name !== client.timezone
    )
      throw new ServiceError(
        "Match this client's currency and timezone to its Meta account in Client settings.",
      );
    const window = performanceWindow(client.timezone, now);
    const source = await fetchMetaReportCsv({
      accessToken: token.accessToken,
      adAccountId: client.metaAdAccountId,
      timezone: client.timezone,
      currency: client.currency,
      sinceIso: window.periodB.startIso,
      untilIso: window.periodA.endIso,
      requireDirectResultEvidence: true,
      now,
    });
    const parsed = parseCsvText(source.csvText);
    const facts = buildPerformanceFacts(
      parsed.rows,
      parsed.headers,
      config,
      now,
    );
    if (
      performanceWindow(client.timezone).periodA.endIso !==
      window.periodA.endIso
    )
      throw new ServiceError(
        "The account calendar changed during this check. Retry for the new day.",
      );
    snapshot = {
      version: 1,
      config,
      checkedAt: new Date().toISOString(),
      facts,
    };
    const saved = await prisma.client.updateMany({
      where,
      data: { performanceMonitorSnapshot: JSON.stringify(snapshot) },
    });
    if (!saved.count)
      throw new ServiceError(
        "Account settings changed during the check. Refresh and retry.",
        409,
      );
  } catch (error) {
    const previous = readPerformanceSnapshot(
      client.performanceMonitorSnapshot,
      config,
      now,
    );
    snapshot = {
      version: 1,
      config,
      checkedAt: previous?.checkedAt ?? now.toISOString(),
      facts: previous?.facts,
      error:
        error instanceof ServiceError
          ? error.message
          : "Meta performance check failed. Prior metrics are not a fresh check; reconnect Meta or retry.",
    };
    await prisma.client.updateMany({
      where,
      data: {
        performanceMonitorSnapshot: JSON.stringify(snapshot),
        performanceMonitorLeaseUntil: null,
      },
    });
    return snapshot;
  }
  try {
    const warnings = snapshot.facts!.campaigns.flatMap((c) =>
      c.signals
        .filter((s) => s.tone === "warning")
        .map(
          (s) =>
            `${c.name} · ${c.objective} · ${s.metric}: ${s.change > 0 ? "+" : ""}${Math.round(s.change)}%. ${s.message}`,
        ),
    );
    if (
      client.performanceMonitorEmailEnabled &&
      warnings.length &&
      (await prisma.client.findFirst({
        where: { ...where, performanceMonitorEmailEnabled: true },
      }))
    ) {
      const key = performanceAlertKey(id, snapshot.facts!.periodA.endIso);
      const text = `${client.accountName} — performance signals to review\nLast 7 completed days: ${snapshot.facts!.periodA.startIso}–${snapshot.facts!.periodA.endIso}\nCompared with: ${snapshot.facts!.periodB.startIso}–${snapshot.facts!.periodB.endIso}\n${warnings.slice(0, 10).join("\n")}\n${warnings.length > 10 ? `${warnings.length - 10} more signals in NextReport.\n` : ""}Review: https://nextreport.in/overview?client=${encodeURIComponent(id)}\nLast checked: ${snapshot.checkedAt}. Meta conversions may be delayed. These are observed changes, not diagnoses or instructions to pause campaigns.`;
      await queueEmail({
        key,
        kind: "PERFORMANCE_ALERT",
        userId,
        payload: {
          to: [client.user.email],
          subject: `NextReport performance review — ${client.accountName}`,
          text,
          html: `<pre style="white-space:pre-wrap">${text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</pre>`,
        },
      });
      const delivery = await deliverQueuedEmail(key);
      if (!delivery.accepted)
        snapshot.emailError =
          "Email has not been confirmed sent. In-app signals remain available.";
    }
  } catch {
    snapshot.emailError =
      "Email could not be confirmed sent. In-app signals remain available.";
  }
  await prisma.client.updateMany({
    where,
    data: {
      performanceMonitorSnapshot: JSON.stringify(snapshot),
      performanceMonitorLeaseUntil: null,
    },
  });
  return snapshot;
}
