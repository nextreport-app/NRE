import { fmtCurrency } from "./format";

export interface BudgetPacingOptions {
  /** Client setting — when false, cover slide never shows pacing regardless of budget. */
  showOnCover?: boolean;
}

/**
 * Cover-slide budget pacing — only when the client opted in via showBudgetPacingOnCover.
 * Over-budget cases use plain language instead of "300%" which reads badly on shared decks.
 */
export function buildBudgetSummary(
  mtdSpend: number,
  monthlyBudget: number | null | undefined,
  currencySymbol: string,
  options: BudgetPacingOptions = {},
): string {
  if (!options.showOnCover) return "";
  if (monthlyBudget == null || monthlyBudget <= 0 || mtdSpend <= 0) return "";

  const pct = Math.round((mtdSpend / monthlyBudget) * 100);
  if (pct > 100) {
    return (
      `Monthly Ad Budget: ${fmtCurrency(mtdSpend, currencySymbol)} spent — ` +
      `over ${fmtCurrency(monthlyBudget, currencySymbol)} reference budget`
    );
  }
  return `Monthly Ad Budget: ${fmtCurrency(mtdSpend, currencySymbol)} of ${fmtCurrency(monthlyBudget, currencySymbol)} used (${pct}%)`;
}

/** Generate-step note when a reference budget exists but cover pacing is off. */
export function budgetReferenceNote(
  monthlyBudget: number | null | undefined,
  showOnCover: boolean,
  currencySymbol: string,
): string | null {
  if (showOnCover) return null;
  if (monthlyBudget == null || monthlyBudget <= 0) return null;
  return (
    `Reference budget ${fmtCurrency(monthlyBudget, currencySymbol)} is saved for your records — ` +
    `not shown on the cover slide (pacing is off in Client Settings).`
  );
}

/** Wizard-time warning before generate — null when pacing is fine or disabled. */
export function budgetPacingWarning(
  mtdSpend: number,
  monthlyBudget: number | null | undefined,
  showOnCover: boolean,
): string | null {
  if (!showOnCover) return null;
  if (monthlyBudget == null || monthlyBudget <= 0) {
    return "Cover budget pacing is on but no monthly budget is set. Add a budget in Client Settings or turn pacing off.";
  }
  if (mtdSpend <= 0) return null;
  const pct = Math.round((mtdSpend / monthlyBudget) * 100);
  if (pct > 100) {
    return `Spend is ${pct}% of the budget you entered. Update the reference budget or turn off cover pacing before sharing with your client.`;
  }
  return null;
}
