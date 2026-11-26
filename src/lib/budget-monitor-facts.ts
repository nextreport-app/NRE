import { getCalendarDateInTimezone } from "./nre/dates";
export interface BudgetConfig {
  monthlyBudget: number | null;
  currency: string;
  timezone: string;
  metaAdAccountId: string | null;
  budgetMonitorTolerance?: number | null;
}
export type BudgetLevel =
  "within" | "projected" | "underspend" | "approaching" | "reached";
export function budgetWindow(timezone: string, now = new Date()) {
  const d = getCalendarDateInTimezone(now, timezone);
  const month = `${d.year}-${String(d.month).padStart(2, "0")}`;
  return {
    month,
    start: `${month}-01`,
    today: `${month}-${String(d.day).padStart(2, "0")}`,
    completedEnd:
      d.day > 1 ? `${month}-${String(d.day - 1).padStart(2, "0")}` : null,
    completedDays: d.day - 1,
    days: new Date(Date.UTC(d.year, d.month, 0)).getUTCDate(),
  };
}
export function effectiveBudgetTolerance(config: BudgetConfig): number {
  const budget = config.monthlyBudget ?? 0;
  const fallback = Math.round(budget * 0.01 * 100) / 100;
  // A reduced approved budget must not retain an allowance larger than that budget.
  return config.budgetMonitorTolerance !== null &&
    config.budgetMonitorTolerance !== undefined &&
    Number.isFinite(config.budgetMonitorTolerance) &&
    config.budgetMonitorTolerance >= 0 &&
    config.budgetMonitorTolerance <= budget
    ? config.budgetMonitorTolerance
    : fallback;
}
export function budgetFacts(
  budget: number,
  spent: number,
  completedSpend: number | null,
  window: ReturnType<typeof budgetWindow>,
  tolerance = Math.round(budget) / 100,
) {
  if (
    !Number.isFinite(budget) ||
    budget <= 0 ||
    !Number.isFinite(spent) ||
    spent < 0 ||
    !Number.isFinite(tolerance) ||
    tolerance < 0 ||
    (completedSpend !== null &&
      (!Number.isFinite(completedSpend) || completedSpend < 0))
  )
    throw Error("Invalid budget or spend.");
  // Include today's actual spend, but project only from completed days (minimum three).
  const projected =
    window.completedDays >= 3 && completedSpend !== null
      ? Math.max(spent, (completedSpend / window.completedDays) * window.days)
      : null;
  const finalWeek = window.days - window.completedDays <= 7;
  const projectedShortfall =
    projected === null ? null : Math.max(0, budget - projected);
  const projectedOver =
    projected === null ? null : Math.max(0, projected - budget);
  const overspendRisk =
    projectedOver !== null &&
    projectedOver > Math.max(tolerance, finalWeek ? 0 : budget * 0.05) + 1e-8;
  const underspendRisk =
    window.completedDays >= 7 &&
    projectedShortfall !== null &&
    projectedShortfall >
      Math.max(tolerance, finalWeek ? 0 : budget * 0.1) + 1e-8;
  const over = Math.max(0, spent - budget);
  const level: BudgetLevel =
    spent >= budget
      ? "reached"
      : overspendRisk
        ? "projected"
        : underspendRisk
          ? "underspend"
          : spent >= budget * 0.8
            ? "approaching"
            : "within";
  // Reaching the approved amount is informative; a tolerated overage only notifies if the forecast still shows material overspend.
  const alertable =
    level === "reached"
      ? over > tolerance + 1e-8 || overspendRisk
      : level !== "within";
  return {
    spent,
    remaining: Math.max(0, budget - spent),
    over,
    usedPercent: (spent / budget) * 100,
    projected,
    projectedShortfall,
    projectedOver,
    tolerance,
    alertable,
    level,
  };
}
export function sameBudgetConfig(a: BudgetConfig, b: BudgetConfig) {
  return (
    effectiveBudgetTolerance(a) === effectiveBudgetTolerance(b) &&
    a.monthlyBudget === b.monthlyBudget &&
    a.currency === b.currency &&
    a.timezone === b.timezone &&
    a.metaAdAccountId?.replace(/^act_/, "") ===
      b.metaAdAccountId?.replace(/^act_/, "")
  );
}
export interface BudgetSnapshot {
  version: 2;
  config: BudgetConfig;
  month: string;
  checkedAt: string;
  facts?: ReturnType<typeof budgetFacts>;
  error?: string;
  emailError?: string;
}
export function readBudgetSnapshot(
  raw: string | null,
  config: BudgetConfig,
  now = new Date(),
): BudgetSnapshot | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as BudgetSnapshot;
    return s.version === 2 &&
      sameBudgetConfig(s.config, config) &&
      s.month === budgetWindow(config.timezone, now).month &&
      Number.isFinite(Date.parse(s.checkedAt))
      ? s
      : null;
  } catch {
    return null;
  }
}
export const BUDGET_LEVEL_LABELS: Record<BudgetLevel, string> = {
  within: "No budget pacing alert",
  underspend: "Projected to underspend budget",
  projected: "Projected to exceed budget",
  approaching: "Approaching approved budget",
  reached: "Approved budget reached or exceeded",
};

/** Shared business severity for the overview and the inline budget panel. */
export function budgetAlertPresentation(
  facts: ReturnType<typeof budgetFacts>,
  budget: number,
  currency: string,
  _daysRemaining: number,
) {
  // Forecast risk remains a warning regardless of days left in the month.
  void _daysRemaining;
  const money = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
  if (facts.over > facts.tolerance + 1e-8)
    return {
      tone: "critical" as const,
      title: "Approved budget exceeded",
      description: `Spend is ${money(facts.over)} above the ${money(budget)} approved budget.`,
    };
  if (facts.alertable && (facts.projectedOver ?? 0) > facts.tolerance)
    return {
      tone: "warning" as const,
      title: "Projected to exceed budget",
      description: `Projected month-end spend is ${money(facts.projected!)} — ${money(facts.projectedOver!)} above budget.`,
    };
  if (facts.alertable && facts.level === "underspend")
    return {
      tone: "warning" as const,
      title: "Projected underspend",
      description: `Projected month-end spend is ${money(facts.projected!)} — ${money(facts.projectedShortfall!)} below budget.`,
    };
  if (facts.level === "reached")
    return {
      tone: "warning" as const,
      title: "Approved budget reached",
      description:
        facts.over > 0
          ? `Spend is ${money(facts.over)} above budget, within the ${money(facts.tolerance)} tolerance.`
          : `The approved ${money(budget)} budget has been used.`,
    };
  if (facts.level === "approaching")
    return {
      tone: "warning" as const,
      title: "Approaching approved budget",
      description: `${money(facts.spent)} of ${money(budget)} spent (${facts.usedPercent.toFixed(1)}%).`,
    };
  return {
    tone: "neutral" as const,
    title: "No budget alert",
    description: `${money(facts.remaining)} remains from the approved budget.`,
  };
}
