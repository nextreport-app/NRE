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

/** Whether the report upload wizard's Campaigns step should be shown in full, skipped with an inline "same as last time" confirmation, or skipped silently. */
export type CampaignStepMode = "skip" | "confirm" | "choose";

export interface ResolvedCampaignSelection {
  selectedCampaigns: string[];
  stepMode: CampaignStepMode;
}

/**
 * Decides whether this upload's Campaigns step needs a real decision from
 * the user, or can be skipped — and if skipped, what the selection defaults
 * to. Three cases, matching the wizard's actual UX:
 *
 *  - A single campaign: nothing to choose between, skip silently — every
 *    campaign is included regardless of any past exclusion (a CSV that's
 *    down to one campaign this week isn't a reason to keep hiding it).
 *  - No saved selection from a previous upload, or a campaign name that
 *    wasn't part of that previous upload's own campaign list: there's a
 *    real decision to make (a first upload, or something genuinely new),
 *    so show the full step. Note this is *not* the same test as "is this
 *    campaign in the excluded list" — a brand-new campaign is, by
 *    definition, absent from both the excluded list and any prior
 *    "campaigns" list, so telling it apart from an old always-included
 *    campaign requires the full previous campaign list, not just the
 *    excluded subset.
 *  - A saved selection exists and every campaign here was already present
 *    last time (none are new): reuse the saved selection (recomputed
 *    against this upload's own campaign list, so a since-removed
 *    exclusion naturally stops mattering) and let the wizard show a brief
 *    confirmation instead of the full step.
 */
export function resolveCampaignSelection(
  campaigns: string[],
  memory: CampaignSelectionMemory | null,
): ResolvedCampaignSelection {
  if (campaigns.length <= 1) {
    return { selectedCampaigns: campaigns, stepMode: "skip" };
  }
  if (!memory) {
    return { selectedCampaigns: campaigns, stepMode: "choose" };
  }
  const previouslySeen = new Set(memory.campaigns);
  const newCampaignAppeared = campaigns.some((name) => !previouslySeen.has(name));
  const deselectedSet = new Set(memory.deselected);
  const selectedCampaigns = campaigns.filter((name) => !deselectedSet.has(name));
  return { selectedCampaigns, stepMode: newCampaignAppeared ? "choose" : "confirm" };
}
