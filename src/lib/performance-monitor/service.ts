import { performanceAlertIntent } from "./alert-intent";
import {
  resolveClientUser,
  updateResolvedProviderUser,
  clientProviderGuard,
} from "@/lib/client-provider-connections";
import { timezonesEquivalent } from "@/lib/timezone-equivalence";
import { buildPerformanceAlertEmail } from "./alert-email";
import { decisionPeriods } from "./settings";
import { applySignalLifecycle, evaluatePerformanceFacts } from "./decision";
import { fetchMetaPerformancePeriodInsights } from "../meta-api";
import { enrichPerformanceMetrics } from "./supplemental-metrics";
import { purchasePeriodMap, type PurchaseEvidence } from "./purchase-values";
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
  buildRecentPerformanceFacts,
  readPerformanceSnapshot,
  type PerformanceSnapshot,
} from "./facts";
import { queueEmail, deliverQueuedEmail } from "../email-delivery";
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
  client.user = await resolveClientUser(client.user, client);
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
    performanceWindowDays: client.performanceWindowDays ?? 7,
    performanceCustomStart: client.performanceCustomStart ?? null,
    performanceCustomEnd: client.performanceCustomEnd ?? null,
    performanceTargetRules: client.performanceTargetRules ?? null,
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
      throw new ServiceError(
        "Reconnect Meta Ads for this client in Client settings.",
      );
    const token = await ensureFreshMetaAccessToken({
      accessToken: decryptMetaToken(client.user.metaAccessToken),
      tokenExpiresAt: client.user.metaTokenExpiresAt,
    });
    if (token.refreshed)
      await updateResolvedProviderUser(
        {
          where: { id: userId },
          data: {
            metaAccessToken: encryptMetaToken(token.accessToken),
            metaTokenExpiresAt: token.tokenExpiresAt,
          },
        },
        client.user,
      );
    const credentialGuard = clientProviderGuard(client.user, "meta");
    if (credentialGuard)
      Object.assign(where, { providerConnections: { some: credentialGuard } });
    const account = await fetchMetaAdAccountMetadata(
      token.accessToken,
      client.metaAdAccountId,
    );
    if (
      account.currency !== client.currency ||
      !timezonesEquivalent(account.timezone_name, client.timezone)
    )
      throw new ServiceError(
        "Match this client's currency and timezone to its Meta account in Client settings.",
      );
    const window = decisionPeriods(client.timezone, config, now);
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
    const lookup = async (
      level: "campaign" | "account",
      period: typeof window.periodA,
    ) =>
      parsed.rows.length
        ? fetchMetaPerformancePeriodInsights({
            accessToken: token.accessToken,
            adAccountId: client.metaAdAccountId!,
            sinceIso: period.startIso,
            untilIso: period.endIso,
            level,
          })
        : [];
    const evidence = await Promise.allSettled([
      lookup("campaign", window.periodA),
      lookup("campaign", window.periodB),
      lookup("account", window.periodA),
      lookup("account", window.periodB),
    ]);
    const rows = (index: number) => {
      const result = evidence[index];
      return result.status === "fulfilled" ? result.value : undefined;
    };
    let purchases: PurchaseEvidence | undefined,
      valueWarning = false;
    if (parsed.rows.some((r) => /purchase/i.test(String(r.result_type)))) {
      try {
        const a = purchasePeriodMap(rows(0) ?? []),
          b = purchasePeriodMap(rows(1) ?? []);
        purchases = Object.fromEntries(
          [...new Set([...Object.keys(a), ...Object.keys(b)])].map((id) => [
            id,
            { current: a[id], previous: b[id] },
          ]),
        );
        valueWarning =
          evidence[0].status === "rejected" ||
          evidence[1].status === "rejected";
      } catch {
        valueWarning = true;
      }
    }
    const facts = buildPerformanceFacts(
      parsed.rows,
      parsed.headers,
      config,
      now,
      purchases,
    );
    facts.valueWarning = valueWarning;
    facts.metricsWarning = evidence.some(
      (result) => result.status === "rejected",
    );
    enrichPerformanceMetrics(facts, {
      currentCampaigns: rows(0),
      previousCampaigns: rows(1),
      currentAccount: rows(2),
      previousAccount: rows(3),
    });
    if (!config.performanceCustomStart) {
      const recentFacts = buildRecentPerformanceFacts(
        parsed.rows,
        parsed.headers,
        config,
        now,
      );
      for (const campaign of facts.campaigns) {
        const recent = recentFacts.campaigns.find(
          (r) =>
            r.objective === campaign.objective &&
            (campaign.id && r.id
              ? r.id === campaign.id
              : r.name === campaign.name),
        );
        if (recent)
          campaign.recent = {
            periodA: recentFacts.periodA,
            periodB: recentFacts.periodB,
            current: recent.current,
            previous: recent.previous,
            comparableResults: recent.comparableResults,
          };
      }
      facts.campaigns = evaluatePerformanceFacts(facts).campaigns;
    }
    applySignalLifecycle(
      facts,
      readPerformanceSnapshot(client.performanceMonitorSnapshot, config, now),
      now,
    );
    if (
      decisionPeriods(client.timezone, config).periodA.endIso !==
      window.periodA.endIso
    )
      throw new ServiceError(
        "The account calendar changed during this check. Retry for the new day.",
      );
    snapshot = {
      version: 2,
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
      version: 2,
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
    const intent = performanceAlertIntent(
      id,
      snapshot,
      client.performanceMonitorEmailEnabled,
    );
    if (
      !config.performanceCustomStart &&
      intent &&
      (await prisma.client.findFirst({
        where: {
          ...where,
          ...(intent.critical ? {} : { performanceMonitorEmailEnabled: true }),
        },
      }))
    ) {
      const key = intent.key;
      const newSignals = intent.alerts;
      const email = buildPerformanceAlertEmail({
        accountName: client.accountName,
        clientId: id,
        snapshot,
        alerts: newSignals,
      });
      await queueEmail({
        key,
        kind: "PERFORMANCE_ALERT",
        userId,
        payload: {
          to: [client.user.email],
          subject: `NextReport ${newSignals.some((s) => s.signal.tone === "critical") ? "critical performance alert" : "performance review"} — ${client.accountName}`,
          ...email,
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
