/**
 * Campaign-level period reach from Meta Insights — matches Ads Manager
 * campaign view (deduplicated unique people for the date range).
 */

import { fetchMetaAdAccountCampaignPeriodInsights, type MetaInsightRow } from "@/lib/meta-api";
import type { DateRangeIso } from "../date-range";
import {
  metaCampaignPeriodReachRangeKey,
  type MetaCampaignPeriodReachMaps,
} from "../campaign-period-reach-maps";

export type { MetaCampaignPeriodReachMaps } from "../campaign-period-reach-maps";
export { metaCampaignPeriodReachRangeKey, lookupMetaCampaignPeriodReach } from "../campaign-period-reach-maps";

function normalizeCampaignKey(name: string): string {
  return String(name || "Unknown Campaign").trim().toLowerCase();
}

export function campaignPeriodReachMapFromInsights(rows: MetaInsightRow[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const row of rows) {
    const name = String(row.campaign_name ?? "").trim();
    if (!name) continue;
    const reach = Number.parseFloat(String(row.reach ?? ""));
    if (!Number.isFinite(reach) || reach <= 0) continue;
    map[normalizeCampaignKey(name)] = Math.round(reach);
  }
  return map;
}

export async function fetchMetaCampaignPeriodReachMaps(input: {
  accessToken: string;
  adAccountId: string;
  ranges: DateRangeIso[];
}): Promise<MetaCampaignPeriodReachMaps> {
  const byRangeKey: Record<string, Record<string, number>> = {};
  const uniqueRanges = new Map<string, DateRangeIso>();
  for (const range of input.ranges) {
    if (!range.startIso || !range.endIso) continue;
    uniqueRanges.set(metaCampaignPeriodReachRangeKey(range.startIso, range.endIso), range);
  }

  for (const range of uniqueRanges.values()) {
    const rows = await fetchMetaAdAccountCampaignPeriodInsights({
      accessToken: input.accessToken,
      adAccountId: input.adAccountId,
      sinceIso: range.startIso,
      untilIso: range.endIso,
    });
    byRangeKey[metaCampaignPeriodReachRangeKey(range.startIso, range.endIso)] =
      campaignPeriodReachMapFromInsights(rows);
  }

  return { byRangeKey };
}

/** Merge session/sync snapshot into fetched maps (API wins on conflict). */
export function mergeMetaCampaignPeriodReachMaps(
  primary: MetaCampaignPeriodReachMaps | undefined,
  secondary: MetaCampaignPeriodReachMaps | undefined,
): MetaCampaignPeriodReachMaps | undefined {
  if (!primary && !secondary) return undefined;
  const byRangeKey: Record<string, Record<string, number>> = { ...(secondary?.byRangeKey ?? {}) };
  for (const [rangeKey, map] of Object.entries(primary?.byRangeKey ?? {})) {
    byRangeKey[rangeKey] = { ...(byRangeKey[rangeKey] ?? {}), ...map };
  }
  return { byRangeKey };
}

export function metaCampaignPeriodReachMapsFromFlatWindow(
  sinceIso: string,
  untilIso: string,
  byCampaign: Record<string, number>,
): MetaCampaignPeriodReachMaps {
  const normalized: Record<string, number> = {};
  for (const [name, reach] of Object.entries(byCampaign)) {
    if (!Number.isFinite(reach) || reach <= 0) continue;
    normalized[normalizeCampaignKey(name)] = Math.round(reach);
  }
  return {
    byRangeKey: {
      [metaCampaignPeriodReachRangeKey(sinceIso, untilIso)]: normalized,
    },
  };
}
