/**
 * NRE v1 — campaign selection (report upload wizard step 1).
 * Pure helpers over already-parsed CSV rows: list the distinct campaigns
 * present, and filter rows down to a chosen subset. Filtering happens
 * before any aggregation/date-splitting, so an excluded campaign never
 * reaches the NRE engine at all — not just hidden from the final report.
 */

import type { NreRow } from "./columns";
import { parseCellNum } from "./format";

/** Distinct campaign names present in the uploaded CSV, in first-seen order. */
export function extractCampaignNames(rows: NreRow[]): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const row of rows) {
    const name = (row.campaign_name || "").trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  return names;
}

/**
 * Per-campaign total spend across the uploaded CSV — Step 2's spend badge
 * ("C$234") and its spend-descending campaign sort. Keyed by the exact
 * campaign_name string as it appears in the CSV (matches extractCampaignNames'
 * own output), not normalized, since callers already look this map up by
 * the same names extractCampaignNames returned.
 */
export function extractCampaignSpend(rows: NreRow[]): Record<string, number> {
  const totalSpendByName = new Map<string, number>();
  for (const row of rows) {
    const name = (row.campaign_name || "").trim();
    if (!name) continue;
    totalSpendByName.set(name, (totalSpendByName.get(name) ?? 0) + parseCellNum(row.spend));
  }
  return Object.fromEntries(totalSpendByName);
}

/** Campaign names sorted by total spend descending (ties broken by first-seen order, via a stable sort over extractCampaignNames' own list) — Step 2's default campaign row order. */
export function sortCampaignsBySpend(names: string[], spendByName: Record<string, number>): string[] {
  return [...names].sort((a, b) => (spendByName[b] ?? 0) - (spendByName[a] ?? 0));
}

// Sub-cent totals are treated as zero — floating-point/rounding noise on an
// otherwise-inactive campaign shouldn't count as "real" spend.
const MIN_CAMPAIGN_SPEND = 0.01;

/**
 * Previous Month Data's own campaign list (Fix 1): only campaigns whose
 * total Amount Spent across every row sums to more than a cent, sorted
 * alphabetically. Deliberately a separate function from
 * extractCampaignNames above, not a shared/modified version of it — that
 * one is also used by the main report wizard's own Campaigns step
 * (reports/analyze/route.ts), which intentionally lists every campaign
 * regardless of spend; this is scoped to Previous Month Data only, whose
 * CSV is a full month/account export that can otherwise surface hundreds
 * of long-paused, zero-spend campaigns in the selection checkbox list.
 */
export function extractSpendingCampaignNames(rows: NreRow[]): string[] {
  const totalSpendByName = new Map<string, number>();
  for (const row of rows) {
    const name = (row.campaign_name || "").trim();
    if (!name) continue;
    totalSpendByName.set(name, (totalSpendByName.get(name) ?? 0) + parseCellNum(row.spend));
  }
  return [...totalSpendByName.entries()]
    .filter(([, totalSpend]) => totalSpend > MIN_CAMPAIGN_SPEND)
    .map(([name]) => name)
    .sort((a, b) => a.localeCompare(b));
}

/**
 * Filters rows down to the selected campaigns. `selectedCampaigns` of
 * `null` means "no selection made" — every row passes through unfiltered
 * (used when a caller genuinely wants everything, e.g. a client that has
 * never gone through the selection step). An empty array is a deliberate
 * "nothing selected" and correctly filters everything out.
 *
 * Matching is case-insensitive (as well as trimmed) — some ad platform
 * exports vary a campaign name's casing between files (e.g. a monthly
 * export vs. a Previous Month Data export for the same account), which
 * would otherwise silently drop an already-selected campaign's rows.
 */
export function filterRowsByCampaigns<T extends NreRow>(rows: T[], selectedCampaigns: string[] | null): T[] {
  if (selectedCampaigns === null) return rows;
  const selected = new Set(selectedCampaigns.map((name) => name.trim().toLowerCase()));
  return rows.filter((row) => selected.has((row.campaign_name || "").trim().toLowerCase()));
}

/** Full campaign list + excluded subset from the upload that last saved a selection — see Client.lastDeselectedCampaigns's schema comment. */
export interface CampaignSelectionMemory {
  campaigns: string[];
  deselected: string[];
}

/**
 * Whether this is the client's first-ever campaign selection ("choose",
 * nothing to pre-check) or a "returning" upload with a saved selection to
 * pre-check — the wizard's Campaigns step is always shown in full either
 * way (see report-upload-wizard.tsx). There used to be a third "skip"/
 * "confirm" pair that silently reused a saved selection (for a single-
 * campaign CSV, or an unchanged returning one) with just a small reuse
 * banner shown later on the Dates step — removed by product decision:
 * always showing the real step, even with only one campaign or an
 * unchanged selection, means the user can always see and correct exactly
 * what's about to be included before generating the report.
 */
export type CampaignStepMode = "choose" | "returning";

export interface ResolvedCampaignSelection {
  selectedCampaigns: string[];
  stepMode: CampaignStepMode;
}

/**
 * Computes the Campaigns step's pre-checked default: everything, for a
 * first-ever upload with no saved selection ("choose"); otherwise this
 * upload's campaigns minus whatever was excluded last time ("returning") —
 * recomputed against this upload's own campaign list, so a since-removed
 * exclusion naturally stops mattering and a brand-new campaign (absent
 * from the saved exclusion list, by definition) defaults to checked.
 */
export function resolveCampaignSelection(
  campaigns: string[],
  memory: CampaignSelectionMemory | null,
): ResolvedCampaignSelection {
  if (!memory) {
    return { selectedCampaigns: campaigns, stepMode: "choose" };
  }
  const deselectedSet = new Set(memory.deselected);
  const selectedCampaigns = campaigns.filter((name) => !deselectedSet.has(name));
  return { selectedCampaigns, stepMode: "returning" };
}

/** Campaigns below this MTD spend (from the uploaded CSV) default unchecked on Step 2. */
export const LOW_SPEND_CAMPAIGN_THRESHOLD = 10;

export function isLowSpendCampaign(name: string, campaignSpend: Record<string, number>, threshold = LOW_SPEND_CAMPAIGN_THRESHOLD): boolean {
  return (campaignSpend[name] ?? 0) < threshold;
}

/**
 * Applies saved selection memory, then drops campaigns under the low-spend
 * threshold so tiny test/paused campaigns do not inflate slide count by default.
 */
export function resolveCampaignSelectionWithLowSpend(
  campaigns: string[],
  memory: CampaignSelectionMemory | null,
  campaignSpend: Record<string, number>,
  threshold = LOW_SPEND_CAMPAIGN_THRESHOLD,
): ResolvedCampaignSelection & { lowSpendCampaigns: string[] } {
  const base = resolveCampaignSelection(campaigns, memory);
  const lowSpendCampaigns = campaigns.filter((name) => isLowSpendCampaign(name, campaignSpend, threshold));
  const selectedCampaigns = base.selectedCampaigns.filter((name) => !isLowSpendCampaign(name, campaignSpend, threshold));
  return { selectedCampaigns, stepMode: base.stepMode, lowSpendCampaigns };
}
