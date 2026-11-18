/** A previous-month row is always scoped to one complete calendar month. */
import { apiQueryCoverage } from "./api-query-coverage";
import type { NreRow } from "./columns";
import { computeCsvDateBounds, filterNreRowsByDateRange } from "./date-range";
import { previousCompleteMonth } from "./report-period-selection";
import { prepareMonthlyCsvFacts, monthlyFactSelectionError } from "./monthly-csv-grain";
import { extractCampaignSpend, extractSpendingCampaignNames } from "./campaigns";

export function previousMonthRows(rows: NreRow[], timezone: string, now = new Date()): NreRow[] | undefined {
  const range = previousCompleteMonth(now, timezone);
  const facts = rows.map(row => ({ ...row }));
  if (prepareMonthlyCsvFacts(facts).errors.length || monthlyFactSelectionError(facts, range)) return undefined;
  const bounds = computeCsvDateBounds(facts);
  if (!bounds || bounds.minIso > range.startIso || bounds.maxIso < range.endIso) return undefined;
  const scoped = filterNreRowsByDateRange(facts, range);
  return scoped.length || apiQueryCoverage(facts) ? scoped : undefined;
}

export function previousMonthSourceInfo(rows: NreRow[] | undefined, source: "import" | "stored", timezone: string, now = new Date()) {
  const scoped = rows && previousMonthRows(rows, timezone, now);
  return {
    ready: !!scoped, source, range: previousCompleteMonth(now, timezone),
    campaigns: scoped ? extractSpendingCampaignNames(scoped) : [],
    campaignSpend: scoped ? extractCampaignSpend(scoped) : {},
  };
}
