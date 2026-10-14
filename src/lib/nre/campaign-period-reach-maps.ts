/** Shared Meta campaign period reach cache shape (no engine imports). */

export type MetaCampaignPeriodReachMaps = {
  byRangeKey: Record<string, Record<string, number>>;
};

export function metaCampaignPeriodReachRangeKey(sinceIso: string, untilIso: string): string {
  return `${sinceIso}:${untilIso}`;
}

function normalizeCampaignKey(name: string): string {
  return String(name || "Unknown Campaign").trim().toLowerCase();
}

export function lookupMetaCampaignPeriodReach(
  maps: MetaCampaignPeriodReachMaps | undefined,
  campaignName: string,
  sinceIso: string,
  untilIso: string,
): number | undefined {
  if (!maps) return undefined;
  const bucket = maps.byRangeKey[metaCampaignPeriodReachRangeKey(sinceIso, untilIso)];
  if (!bucket) return undefined;
  const value = bucket[normalizeCampaignKey(campaignName)];
  return value != null && value > 0 ? value : undefined;
}
