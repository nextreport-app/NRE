/**
 * NRE v1 — campaign selection (report upload wizard step 1).
 * Pure helpers over already-parsed CSV rows: list the distinct campaigns
 * present, and filter rows down to a chosen subset. Filtering happens
 * before any aggregation/date-splitting, so an excluded campaign never
 * reaches the NRE engine at all — not just hidden from the final report.
 */

import type { NreRow } from "./columns";

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
 * Filters rows down to the selected campaigns. `selectedCampaigns` of
 * `null` means "no selection made" — every row passes through unfiltered
 * (used when a caller genuinely wants everything, e.g. a client that has
 * never gone through the selection step). An empty array is a deliberate
 * "nothing selected" and correctly filters everything out.
 */
export function filterRowsByCampaigns<T extends NreRow>(rows: T[], selectedCampaigns: string[] | null): T[] {
  if (selectedCampaigns === null) return rows;
  const selected = new Set(selectedCampaigns.map((name) => name.trim()));
  return rows.filter((row) => selected.has((row.campaign_name || "").trim()));
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
