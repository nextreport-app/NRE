import type { MetaInsightRow } from "@/lib/meta-api";
import { countRowsWithCostedAdsetWebsiteResult } from "./conversion-field-signals";

/**
 * Ads Manager daily CSV is ad-set delivery. When the ad-set API already returns
 * costed website/lead pairs, campaign-level merge inflates Results (Credit Firm 16 vs 12).
 * Use enriched campaign fallback only when ad-set rows have no costed website at all.
 */
export function resolveMetaInsightRowsForCsvExport(
  adsetRows: MetaInsightRow[],
  enrichedRows: MetaInsightRow[] | null,
  usedCampaignLevelConversionFallback: boolean,
): MetaInsightRow[] {
  if (countRowsWithCostedAdsetWebsiteResult(adsetRows) > 0) {
    return adsetRows;
  }
  if (usedCampaignLevelConversionFallback && enrichedRows) {
    return enrichedRows;
  }
  return adsetRows;
}
