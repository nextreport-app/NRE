import { getCalendarDateInTimezone } from "./nre/dates";
export interface BudgetConfig { monthlyBudget: number | null; currency: string; timezone: string; metaAdAccountId: string | null }
export type BudgetLevel = "within" | "projected" | "approaching" | "reached";
export function budgetWindow(timezone: string, now = new Date()) {
  const d = getCalendarDateInTimezone(now, timezone);
  const month = `${d.year}-${String(d.month).padStart(2,"0")}`;
  return {month, start: `${month}-01`, today: `${month}-${String(d.day).padStart(2,"0")}`,
    completedEnd: d.day > 1 ? `${month}-${String(d.day-1).padStart(2,"0")}` : null,
    completedDays: d.day-1, days: new Date(Date.UTC(d.year,d.month,0)).getUTCDate()};
}
export function budgetFacts(budget: number, spent: number, completedSpend: number | null, window: ReturnType<typeof budgetWindow>) {
  if (!Number.isFinite(budget) || budget <= 0 || !Number.isFinite(spent) || spent < 0 ||
    (completedSpend !== null && (!Number.isFinite(completedSpend) || completedSpend < 0))) throw Error("Invalid budget or spend.");
  // Include today's actual spend, but project only from completed days (minimum three).
  const projected = window.completedDays >= 3 && completedSpend !== null ? Math.max(spent,completedSpend/window.completedDays*window.days) : null;
  const level: BudgetLevel = spent >= budget ? "reached" : spent >= budget*.8 ? "approaching" : projected !== null && projected > budget*1.05 ? "projected" : "within";
  return {spent, remaining: Math.max(0,budget-spent), over: Math.max(0,spent-budget), usedPercent: spent/budget*100, projected, level};
}
export function sameBudgetConfig(a: BudgetConfig, b: BudgetConfig) {
  return a.monthlyBudget === b.monthlyBudget && a.currency === b.currency && a.timezone === b.timezone && a.metaAdAccountId?.replace(/^act_/,"") === b.metaAdAccountId?.replace(/^act_/,"");
}
export interface BudgetSnapshot { config: BudgetConfig; month: string; checkedAt: string; facts?: ReturnType<typeof budgetFacts>; error?: string; emailError?: string }
export function readBudgetSnapshot(raw: string | null, config: BudgetConfig, now = new Date()): BudgetSnapshot | null {
  if (!raw) return null;
  try {const s=JSON.parse(raw) as BudgetSnapshot;
    return sameBudgetConfig(s.config,config) && s.month === budgetWindow(config.timezone,now).month && Number.isFinite(Date.parse(s.checkedAt)) ? s : null;
  } catch {return null;}
}
export const BUDGET_LEVEL_LABELS: Record<BudgetLevel,string> = {
  within: "Within approved budget", projected: "Projected to exceed budget", approaching: "Approaching approved budget", reached: "Approved budget reached or exceeded",
};
