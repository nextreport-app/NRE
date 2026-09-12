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
