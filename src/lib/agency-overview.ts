import {
  readBudgetSnapshot,
  BUDGET_LEVEL_LABELS,
  type BudgetConfig,
} from "./budget-monitor-facts";
import {
  readPerformanceSnapshot,
  isPerformanceFresh,
  type PerformanceConfig,
} from "./performance-monitor/facts";
import {
  actionableSignals,
  campaignVerdict,
  type Verdict,
} from "./performance-monitor/decision";
import { readCampaignTargets } from "./performance-monitor/settings";
import {
  campaignBrief,
  campaignRank,
  type PortfolioState,
} from "./performance-monitor/portfolio";
import { budgetWindow } from "./budget-monitor-facts";
export interface OverviewClient extends BudgetConfig, PerformanceConfig {
  id: string;
  accountName: string;
  budgetMonitorEnabled: boolean;
  budgetMonitorSnapshot: string | null;
  performanceMonitorEnabled: boolean;
  performanceMonitorEmailEnabled: boolean;
  performanceMonitorSnapshot: string | null;
}
export function overviewRow(client: OverviewClient, now = new Date()) {
  const budget = readBudgetSnapshot(client.budgetMonitorSnapshot, client, now),
    performance = readPerformanceSnapshot(
      client.performanceMonitorSnapshot,
      client,
      now,
    );
  const budgetFresh =
    client.budgetMonitorEnabled &&
    !!budget?.facts &&
    !budget.error &&
    Date.parse(budget.checkedAt) <= now.getTime() &&
    now.getTime() - Date.parse(budget.checkedAt) < 26 * 3600000;
  const performanceFresh =
    client.performanceMonitorEnabled && isPerformanceFresh(performance, now);
  const warnings = performanceFresh
    ? performance!.facts!.campaigns.reduce(
        (n, c) => n + actionableSignals(c).length,
        0,
      )
    : 0;
  const budgetAttention = budgetFresh && !!budget?.facts?.alertable;
  const unavailable =
    !!client.metaAdAccountId &&
    ((client.budgetMonitorEnabled && !budgetFresh) ||
      (client.performanceMonitorEnabled && !performanceFresh));
  const counts = { critical: 0, review: 0, improving: 0, neutral: 0 };
  if (performanceFresh)
    for (const c of performance!.facts!.campaigns) counts[campaignVerdict(c)]++;
  const bw = budgetWindow(client.timezone, now),
    bf = budgetFresh ? budget?.facts : undefined;
  const budgetCritical =
    !!bf &&
    (bf.over > bf.tolerance + 1e-8 ||
      (bw.days - bw.completedDays <= 7 &&
        bf.alertable &&
        (bf.projectedOver! > bf.tolerance ||
          bf.projectedShortfall! > bf.tolerance)));
  const verdict: Verdict =
    counts.critical || budgetCritical
      ? "critical"
      : counts.review || budgetAttention
        ? "review"
        : counts.improving
          ? "improving"
          : "neutral";
  const briefs = performanceFresh
    ? [...performance!.facts!.campaigns]
        .sort((a, b) => campaignRank(a) - campaignRank(b))
        .map(campaignBrief)
    : [];
  const coverage = {
    assessed: briefs.filter(
      (c) => !["insufficient", "no-delivery"].includes(c.state),
    ).length,
    insufficient: briefs.filter((c) => c.state === "insufficient").length,
    inactive: briefs.filter((c) => c.state === "no-delivery").length,
    total: briefs.length,
  };
  const state: PortfolioState =
    verdict === "critical"
      ? "critical"
      : verdict === "review"
        ? "review"
        : unavailable
          ? "check"
          : !client.metaAdAccountId || !client.performanceMonitorEnabled
            ? "setup"
            : !briefs.length
              ? "no-delivery"
              : verdict === "improving"
                ? "positive"
                : coverage.insufficient
                  ? "insufficient"
                  : briefs.some((c) => c.state === "neutral")
                    ? "neutral"
                    : "no-delivery";
  return {
    portfolio: {
      state,
      coverage,
      lead: briefs[0] ?? null,
      positiveCampaigns: briefs.filter((c) => c.state === "positive").length,
      reviewCampaigns: briefs.filter(
        (c) => c.state === "review" || c.state === "critical",
      ).length,
    },
    verdict,
    counts,
    budgetCritical,
    priorityReason: performanceFresh
      ? (performance!
          .facts!.campaigns.flatMap((c) =>
            actionableSignals(c).map((s) => ({
              tone: s.tone,
              text: `${c.name}: ${s.message}`,
            })),
          )
          .sort(
            (a, b) =>
              Number(b.tone === "critical") - Number(a.tone === "critical"),
          )[0]?.text ?? null)
      : null,
    dailyAllowance: bf ? bf.remaining / (bw.days - bw.completedDays) : null,
    comparison: {
      days: client.performanceWindowDays ?? 7,
      customStart: client.performanceCustomStart ?? "",
      customEnd: client.performanceCustomEnd ?? "",
    },
    targets: readCampaignTargets(
      client.performanceTargetRules,
      client.metaAdAccountId,
      client.currency,
    ),
    id: client.id,
    name: client.accountName,
    currency: client.currency,
    timezone: client.timezone,
    linked: !!client.metaAdAccountId,
    performanceEnabled: client.performanceMonitorEnabled,
    emailEnabled: client.performanceMonitorEmailEnabled,
    budgetEnabled: client.budgetMonitorEnabled,
    budget: client.budgetMonitorEnabled ? budget : null,
    budgetFresh,
    budgetLabel: budgetFresh
      ? BUDGET_LEVEL_LABELS[budget!.facts!.level]
      : client.budgetMonitorEnabled
        ? "Budget check needed"
        : "Budget monitoring off",
    performance: client.performanceMonitorEnabled ? performance : null,
    performanceFresh,
    warnings,
    budgetAttention,
    unavailable,
    needsAttention: budgetAttention || warnings > 0,
    adsManagerUrl:
      client.metaAdAccountId && /^(act_)?\d+$/.test(client.metaAdAccountId)
        ? `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${client.metaAdAccountId.replace(/^act_/, "")}`
        : null,
  };
}
export type OverviewRow = ReturnType<typeof overviewRow>;
