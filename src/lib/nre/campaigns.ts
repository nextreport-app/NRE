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
