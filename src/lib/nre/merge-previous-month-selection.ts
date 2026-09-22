import { isLowSpendCampaign, LOW_SPEND_CAMPAIGN_THRESHOLD } from "./campaigns";

function normName(name: string): string {
  return name.trim().toLowerCase();
}

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

  const selectedSet = new Set(previousSelected.map(normName));
  const oldAllNorm = new Set((previousAllCampaigns ?? []).map(normName));

  return allCampaigns.filter((name) => {
    if (selectedSet.has(normName(name))) return true;
    // New in this month's file — not present last time — default to included.
    return !oldAllNorm.has(normName(name));
  });
}

/** Saved selection that lists every campaign in the file — legacy "all checked" uploads. */
function isImplicitFullSelection(allCampaigns: string[], previousSelected: string[] | null | undefined): boolean {
  if (!previousSelected || previousSelected.length === 0) return false;
  if (previousSelected.length !== allCampaigns.length) return false;
  const selectedSet = new Set(previousSelected.map(normName));
  return allCampaigns.every((name) => selectedSet.has(normName(name)));
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
  const implicitFull = isImplicitFullSelection(allCampaigns, previousSelected);
  const merged = mergePreviousMonthSelection(
    allCampaigns,
    implicitFull ? null : previousSelected,
    previousAllCampaigns,
  );
  const selectedCampaigns = merged.filter((name) => {
    if (!isLowSpendCampaign(name, campaignSpend, threshold)) return true;
    if (implicitFull) return false;
    const existedBefore = (previousAllCampaigns ?? []).some((prev) => normName(prev) === normName(name));
    const explicitlySelected = previousSelected?.some((prev) => normName(prev) === normName(name)) ?? false;
    return existedBefore && explicitlySelected;
  });
  return { selectedCampaigns, lowSpendCampaigns };
}

/** Checkbox UI + report row — single source for which campaigns start checked. */
export function resolvePreviousMonthUiSelection(
  campaigns: string[],
  campaignSpend: Record<string, number>,
  savedSelected: string[] | null | undefined,
): { selectedCampaigns: string[]; lowSpendCampaigns: string[] } {
  return mergePreviousMonthSelectionWithLowSpend(campaigns, campaignSpend, savedSelected, campaigns);
}
