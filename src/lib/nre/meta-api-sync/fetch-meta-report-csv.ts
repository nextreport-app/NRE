import { labelMetaInsightIdentities } from "./insight-identities";
import { API_RANGE_START_HEADER, API_RANGE_END_HEADER } from "../api-query-coverage";
import { validateMetaClickRates } from "./validate-click-rates";
import { configuredResultAction } from "./configured-result-event";
import { fetchMetaAdSetReportingConfigs } from "@/lib/meta-api";
import { directlyEvidencedResult } from "./direct-result-evidence";
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
  insightToManualCsvRowWithResult,
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
  currency: string;
  requireDirectResultEvidence?: boolean;
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
      includeResultChannels: !input.requireDirectResultEvidence,
    })
  ).map(normalizeMetaInsightRow);

  let deduped = dedupeInsightsByAdSetDay(insights).filter(
    (r) => r.campaign_name && r.date_start,
  );

  if (input.requireDirectResultEvidence) {
    deduped.forEach(validateMetaClickRates);
    const configs = await fetchMetaAdSetReportingConfigs(input.accessToken, deduped.flatMap(row => row.adset_id ? [row.adset_id] : []));
    const byId = new Map(configs.map(config => [config.id, config]));
    deduped = deduped.map(row => {
      const config = row.adset_id ? byId.get(row.adset_id) : undefined;
      return config ? { ...row, optimization_goal: config.optimization_goal ?? row.optimization_goal, configured_result_action: configuredResultAction(config) } : row;
    });
  }

  const adsetRows = deduped;
  let usedCampaignLevelConversionFallback = false;
  let enrichedRows: MetaInsightRow[] | null = null;
  const adsetWithConversion = countRowsWithConversionFields(adsetRows);
  if (!input.requireDirectResultEvidence && adsetRows.length > 0 && adsetWithConversion < Math.max(1, Math.floor(adsetRows.length * 0.2))) {
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

  const identities = labelMetaInsightIdentities(deduped);
  deduped = identities.rows;
  if (process.env.META_SYNC_DEBUG === "true") logIngestionNormalizationSample(deduped);
  const dataRows = deduped.map(row => input.requireDirectResultEvidence ? insightToManualCsvRowWithResult(row, directlyEvidencedResult(row)) : insightToManualCsvRow(row));

  if (input.requireDirectResultEvidence) dataRows.forEach((row, index) => row.push(
    sinceIso, untilIso,
    deduped[index].configured_result_action ? "actions.value" : "delivery_or_actions",
    "adset_unified", "impression",
  ));
  const headers = META_CSV_HEADERS.map(header => header === "Amount spent (USD)" ? `Amount spent (${input.currency})` : header);
  if (input.requireDirectResultEvidence) headers.push(API_RANGE_START_HEADER, API_RANGE_END_HEADER, "NRE API result source", "NRE API attribution mode", "NRE API action report time");
  let csvText = rowsToCsv(headers, dataRows);

  if (input.referenceManualCsvText?.trim()) {
    csvText = mergeApiCsvWithManualReference(csvText, input.referenceManualCsvText);
  }

  const rowCount = dataRows.length;
  const diagnostics = buildMetaSyncDiagnostics(deduped, {
    usedCampaignLevelConversionFallback,
    resultForRow: input.requireDirectResultEvidence ? directlyEvidencedResult : undefined,
  });

  diagnostics.mappedResultsSum = dataRows.reduce((sum, row) => sum + (Number(row[META_CSV_HEADERS.indexOf("Results")]) || 0), 0);

  const campaignPeriodRows = await fetchMetaAdAccountCampaignPeriodInsights({
    accessToken: input.accessToken,
    adAccountId: input.adAccountId,
    sinceIso,
    untilIso,
  });
  const campaignPeriodReachByName = campaignPeriodReachMapFromInsights(campaignPeriodRows.map(row => ({ ...row, campaign_name: row.campaign_id ? identities.campaignLabels.get(row.campaign_id) ?? row.campaign_name : row.campaign_name })));
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
