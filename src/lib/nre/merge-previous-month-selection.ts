import { isLowSpendCampaign, LOW_SPEND_CAMPAIGN_THRESHOLD } from "./campaigns";

/**
 * When Previous Month Data is refreshed (API auto-sync or re-upload), preserve
 * campaigns the user already excluded while defaulting newly appearing campaigns
 * to selected.
 */
export function mergePreviousMonthSelection(
  allCampaigns: string[],
  previousSelected: string[] | null | undefined,
  previousAllCampaigns: string[] | null | undefined,
): string[] {
  if (allCampaigns.length === 0) return [];
  if (!previousSelected || previousSelected.length === 0) {
    return [...allCampaigns];
  }

  const selectedSet = new Set(previousSelected);
  const oldAll = previousAllCampaigns ?? [];

  return allCampaigns.filter((name) => {
    if (selectedSet.has(name)) return true;
    // New in this month's file — not present last time — default to included.
    return !oldAll.includes(name);
  });
}

/**
 * Applies the same sub-threshold spend default as the main wizard Campaigns
 * step — low-spend campaigns start unchecked unless the user explicitly kept
 * them selected in a prior upload of previous-month data.
 */
export function mergePreviousMonthSelectionWithLowSpend(
  allCampaigns: string[],
  campaignSpend: Record<string, number>,
  previousSelected: string[] | null | undefined,
  previousAllCampaigns: string[] | null | undefined,
  threshold = LOW_SPEND_CAMPAIGN_THRESHOLD,
): { selectedCampaigns: string[]; lowSpendCampaigns: string[] } {
  const lowSpendCampaigns = allCampaigns.filter((name) => isLowSpendCampaign(name, campaignSpend, threshold));
  const merged = mergePreviousMonthSelection(allCampaigns, previousSelected, previousAllCampaigns);
  const selectedCampaigns = merged.filter((name) => {
    if (!isLowSpendCampaign(name, campaignSpend, threshold)) return true;
    const existedBefore = (previousAllCampaigns ?? []).includes(name);
    return existedBefore && (previousSelected?.includes(name) ?? false);
  });
  return { selectedCampaigns, lowSpendCampaigns };
}
