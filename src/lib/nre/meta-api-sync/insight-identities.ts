import type { MetaInsightRow } from "@/lib/meta-api";
/** Identical display names must not merge separate Meta campaign/ad-set IDs. */
export function labelMetaInsightIdentities(rows: MetaInsightRow[]) {
  const campaignIds = new Map<string, Set<string>>();
  const adsetIds = new Map<string, Set<string>>();
  for (const row of rows) {
    if (row.campaign_id) { const ids = campaignIds.get(row.campaign_name ?? "") ?? new Set<string>(); ids.add(row.campaign_id); campaignIds.set(row.campaign_name ?? "", ids); }
    if (row.adset_id) { const key = `${row.campaign_id ?? row.campaign_name}\0${row.adset_name}`; const ids = adsetIds.get(key) ?? new Set<string>(); ids.add(row.adset_id); adsetIds.set(key, ids); }
  }
  const campaignLabels = new Map<string, string>();
  const labeled = rows.map(row => {
    const campaignName = row.campaign_id && (campaignIds.get(row.campaign_name ?? "")?.size ?? 0) > 1 ? `${row.campaign_name} [${row.campaign_id}]` : row.campaign_name;
    if (row.campaign_id && campaignName) campaignLabels.set(row.campaign_id, campaignName);
    const key = `${row.campaign_id ?? row.campaign_name}\0${row.adset_name}`;
    return { ...row, campaign_name: campaignName, adset_name: row.adset_id && (adsetIds.get(key)?.size ?? 0) > 1 ? `${row.adset_name} [${row.adset_id}]` : row.adset_name };
  });
  return { rows: labeled, campaignLabels };
}
