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
    now.getTime() - Date.parse(budget.checkedAt) < 26 * 3600000;
  const performanceFresh =
    client.performanceMonitorEnabled && isPerformanceFresh(performance, now);
  const warnings = performanceFresh
    ? performance!.facts!.campaigns.reduce(
        (n, c) => n + c.signals.filter((s) => s.tone === "warning").length,
        0,
      )
    : 0;
  const budgetAttention = budgetFresh && !!budget?.facts?.alertable;
  const unavailable =
    !!client.metaAdAccountId &&
    ((client.budgetMonitorEnabled && !budgetFresh) ||
      (client.performanceMonitorEnabled && !performanceFresh));
  return {
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
