import { getCalendarDateInTimezone } from "./dates";
import { fmtCurrency } from "./format";

export interface BudgetPacingOptions {
  /** Client setting — when false, cover slide never shows pacing regardless of budget. */
  showOnCover?: boolean;
  /** Client timezone — used for days-remaining on the cover line. */
  timezone?: string;
  asOf?: Date;
}

/** Whole days left in the current calendar month (client timezone), including today. */
export function monthDaysRemaining(timezone: string, asOf: Date = new Date()): number {
  const today = getCalendarDateInTimezone(asOf, timezone);
  const lastDayOfMonth = new Date(today.year, today.month, 0).getDate();
  return Math.max(0, lastDayOfMonth - today.day);
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

  const daysSuffix =
    options.timezone != null ? ` — ${monthDaysRemaining(options.timezone, options.asOf)} days remaining` : "";

  const pct = Math.round((mtdSpend / monthlyBudget) * 100);
  if (pct > 100) {
    return (
      `Monthly Ad Budget: ${fmtCurrency(mtdSpend, currencySymbol)} spent — ` +
      `over ${fmtCurrency(monthlyBudget, currencySymbol)} reference budget${daysSuffix}`
    );
  }
  return `Monthly Ad Budget: ${fmtCurrency(mtdSpend, currencySymbol)} of ${fmtCurrency(monthlyBudget, currencySymbol)} used (${pct}%)${daysSuffix}`;
}

/** Wizard preview — what the cover line would say (ignores showOnCover toggle). */
export function buildBudgetCoverPreview(
  mtdSpend: number,
  monthlyBudget: number | null | undefined,
  currencySymbol: string,
  timezone: string,
  asOf: Date = new Date(),
): string | null {
  if (monthlyBudget == null || monthlyBudget <= 0) return null;
  const spend = mtdSpend > 0 ? mtdSpend : 0;
  if (spend <= 0) {
    return `Monthly Ad Budget: ${fmtCurrency(0, currencySymbol)} of ${fmtCurrency(monthlyBudget, currencySymbol)} used (0%) — ${monthDaysRemaining(timezone, asOf)} days remaining`;
  }
  return buildBudgetSummary(spend, monthlyBudget, currencySymbol, {
    showOnCover: true,
    timezone,
    asOf,
  });
}

/** Wizard-time warning before generate — null when pacing is fine or disabled. */
export function budgetPacingWarning(
  mtdSpend: number,
  monthlyBudget: number | null | undefined,
  showOnCover: boolean,
): string | null {
  if (!showOnCover) return null;
  if (monthlyBudget == null || monthlyBudget <= 0) {
    return "Set a monthly budget for this client to show pacing on the cover slide.";
  }
  if (mtdSpend <= 0) return null;
  const pct = Math.round((mtdSpend / monthlyBudget) * 100);
  if (pct > 100) {
    return `Spend is ${pct}% of the budget you entered. Update the reference budget or turn off the cover toggle before sharing with your client.`;
  }
  return null;
}
