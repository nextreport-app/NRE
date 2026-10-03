import type { MetaInsightRow } from "@/lib/meta-api";
import { hasMeaningfulConversionFields } from "./conversion-field-signals";

function campaignDayKey(row: MetaInsightRow): string | null {
  if (!row.campaign_name?.trim() || !row.date_start?.trim()) return null;
  return `${row.campaign_name.trim()}\0${row.date_start.trim()}`;
}

function adsetDayKey(row: MetaInsightRow): string | null {
  if (!row.campaign_name?.trim() || !row.date_start?.trim()) return null;
  const adset = (row.adset_name ?? "").trim();
  return `${row.campaign_name.trim()}\0${adset}\0${row.date_start.trim()}`;
}

function rowHasConversionFields(row: MetaInsightRow): boolean {
  return hasMeaningfulConversionFields(row);
}

/**
 * When ad-set insights omit results[] (common live bug) but campaign-level includes them,
 * copy conversion fields onto ad-set rows only if that campaign+day has a single ad set
 * in this fetch (avoids duplicating campaign totals across multiple ad sets).
 */
export function enrichAdSetInsightsFromCampaignLevel(
  adsetRows: MetaInsightRow[],
  campaignRows: MetaInsightRow[],
): MetaInsightRow[] {
  const adsetsPerCampaignDay = new Map<string, number>();
  for (const row of adsetRows) {
    const key = campaignDayKey(row);
    if (!key) continue;
    adsetsPerCampaignDay.set(key, (adsetsPerCampaignDay.get(key) ?? 0) + 1);
  }

  const campaignByDay = new Map<string, MetaInsightRow>();
  for (const row of campaignRows) {
    const key = campaignDayKey(row);
    if (key && hasMeaningfulConversionFields(row)) {
      campaignByDay.set(key, row);
    }
  }

  return adsetRows.map((row) => {
    if (hasMeaningfulConversionFields(row)) return row;
    const campKey = campaignDayKey(row);
    if (!campKey || (adsetsPerCampaignDay.get(campKey) ?? 0) !== 1) return row;
    const campaign = campaignByDay.get(campKey);
    if (!campaign) return row;
    return {
      ...row,
      results: campaign.results,
      cost_per_result: campaign.cost_per_result,
      objective_results: campaign.objective_results,
      cost_per_objective_result: campaign.cost_per_objective_result,
    };
  });
}

export function countRowsWithConversionFields(rows: MetaInsightRow[]): number {
  return rows.filter((r) => hasMeaningfulConversionFields(r)).length;
}

export { adsetDayKey, campaignDayKey };
