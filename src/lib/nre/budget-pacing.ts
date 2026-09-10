import { fmtCurrency } from "./format";

/**
 * Cover-slide budget pacing line — "Monthly Ad Budget: ₹X of ₹Y used (Z%)".
 * Blank when no budget is set or spend is zero (paused / no delivery).
 */
export function buildBudgetSummary(
  mtdSpend: number,
  monthlyBudget: number | null | undefined,
  currencySymbol: string,
): string {
  if (monthlyBudget == null || monthlyBudget <= 0 || mtdSpend <= 0) return "";
  const pct = Math.min(999, Math.round((mtdSpend / monthlyBudget) * 100));
  return `Monthly Ad Budget: ${fmtCurrency(mtdSpend, currencySymbol)} of ${fmtCurrency(monthlyBudget, currencySymbol)} used (${pct}%)`;
}
