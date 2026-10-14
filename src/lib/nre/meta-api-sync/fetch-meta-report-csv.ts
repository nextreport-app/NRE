import { fetchMetaAdAccountInsights, type MetaInsightRow } from "@/lib/meta-api";
import { computeLastNDaysIsoRange } from "../api-date-range";
import { rowsToCsv } from "../rows-to-csv";
import { logIngestionNormalizationSample } from "./api-csv-normalize";
import {
  countRowsWithConversionFields,
  enrichAdSetInsightsFromCampaignLevel,
} from "./enrich-adset-from-campaign";
import {
  META_CSV_HEADERS,
  dedupeInsightsByAdSetDay,
  insightToManualCsvRow,
} from "./insight-engine";
import { resolveMetaInsightRowsForCsvExport } from "./resolve-rows-for-csv-export";
import { mergeApiCsvWithManualReference } from "./merge-reference-manual-csv";
import { normalizeMetaInsightRow } from "./normalize-insight-row";
import { buildMetaSyncDiagnostics, type MetaSyncDiagnostics } from "./sync-diagnostics";
import {
  campaignPeriodReachMapFromInsights,
  metaCampaignPeriodReachMapsFromFlatWindow,
  type MetaCampaignPeriodReachMaps,
} from "./fetch-campaign-period-reach";
import { fetchMetaAdAccountCampaignPeriodInsights } from "@/lib/meta-api";

export interface FetchMetaReportCsvInput {
  accessToken: string;
  adAccountId: string;
  timezone: string;
  now?: Date;
  days?: number;
  /** When set, overrides the default last-N-days window (e.g. previous calendar month sync). */
  sinceIso?: string;
  untilIso?: string;
  /** Ads Manager CSV — Result columns are copied from this file (API refreshes spend/reach). */
  referenceManualCsvText?: string;
}

/**
 * Meta API sync entry point: fetch ad-set daily insights, convert each row with
 * manual-export parity rules, emit CSV bytes for the same import path as uploads.
 */
export async function fetchMetaReportCsv(input: FetchMetaReportCsvInput): Promise<{
  csvText: string;
  rowCount: number;
  sinceIso: string;
  untilIso: string;
  diagnostics: MetaSyncDiagnostics;
  /** Campaign-level deduplicated reach for the sync window (Ads Manager campaign view). */
  campaignPeriodReachByName: Record<string, number>;
  campaignPeriodReachMaps: MetaCampaignPeriodReachMaps;
}> {
  const { sinceIso, untilIso } =
    input.sinceIso && input.untilIso
      ? { sinceIso: input.sinceIso, untilIso: input.untilIso }
      : computeLastNDaysIsoRange(input.now ?? new Date(), input.timezone, input.days ?? 30);

  const insights = (
    await fetchMetaAdAccountInsights({
      accessToken: input.accessToken,
      adAccountId: input.adAccountId,
      sinceIso,
      untilIso,
      level: "adset",
    })
  ).map(normalizeMetaInsightRow);

  let deduped = dedupeInsightsByAdSetDay(insights).filter(
    (r) => r.campaign_name && r.date_start,
  );

  const adsetRows = deduped;
  let usedCampaignLevelConversionFallback = false;
  let enrichedRows: MetaInsightRow[] | null = null;
  const adsetWithConversion = countRowsWithConversionFields(adsetRows);
  if (adsetRows.length > 0 && adsetWithConversion < Math.max(1, Math.floor(adsetRows.length * 0.2))) {
    const campaignInsights = (
      await fetchMetaAdAccountInsights({
        accessToken: input.accessToken,
        adAccountId: input.adAccountId,
        sinceIso,
        untilIso,
        level: "campaign",
      })
    ).map(normalizeMetaInsightRow);
    enrichedRows = enrichAdSetInsightsFromCampaignLevel(adsetRows, campaignInsights);
    if (countRowsWithConversionFields(enrichedRows) > adsetWithConversion) {
      usedCampaignLevelConversionFallback = true;
    }
  }

  deduped = resolveMetaInsightRowsForCsvExport(
    adsetRows,
    enrichedRows,
    usedCampaignLevelConversionFallback,
  );

  logIngestionNormalizationSample(deduped);
  const dataRows = deduped.map(insightToManualCsvRow);

  let csvText = rowsToCsv([...META_CSV_HEADERS], dataRows);

  if (input.referenceManualCsvText?.trim()) {
    csvText = mergeApiCsvWithManualReference(csvText, input.referenceManualCsvText);
  }

  const rowCount = Math.max(0, csvText.split("\n").filter(Boolean).length - 1);
  const diagnostics = buildMetaSyncDiagnostics(deduped, {
    usedCampaignLevelConversionFallback,
  });

  const campaignPeriodRows = await fetchMetaAdAccountCampaignPeriodInsights({
    accessToken: input.accessToken,
    adAccountId: input.adAccountId,
    sinceIso,
    untilIso,
  });
  const campaignPeriodReachByName = campaignPeriodReachMapFromInsights(campaignPeriodRows);
  const campaignPeriodReachMaps = metaCampaignPeriodReachMapsFromFlatWindow(
    sinceIso,
    untilIso,
    campaignPeriodReachByName,
  );

  return {
    csvText,
    rowCount,
    sinceIso,
    untilIso,
    diagnostics,
    campaignPeriodReachByName,
    campaignPeriodReachMaps,
  };
}
