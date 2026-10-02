import { fetchMetaAdAccountInsights } from "@/lib/meta-api";
import { computeLastNDaysIsoRange } from "../api-date-range";
import { rowsToCsv } from "../rows-to-csv";
import { logIngestionNormalizationSample } from "./api-csv-normalize";
import {
  META_CSV_HEADERS,
  dedupeInsightsByAdSetDay,
  insightToManualCsvRow,
} from "./insight-engine";
import { sumResultsInMetaSyncCsv } from "./count-meta-sync-results";
import { mergeApiCsvWithManualReference } from "./merge-reference-manual-csv";

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
  /** Results total from API mapper only (before optional manual merge). */
  inferredResultsTotal: number;
  mergedWithManualReference: boolean;
}> {
  const { sinceIso, untilIso } =
    input.sinceIso && input.untilIso
      ? { sinceIso: input.sinceIso, untilIso: input.untilIso }
      : computeLastNDaysIsoRange(input.now ?? new Date(), input.timezone, input.days ?? 30);

  const insights = await fetchMetaAdAccountInsights({
    accessToken: input.accessToken,
    adAccountId: input.adAccountId,
    sinceIso,
    untilIso,
    level: "adset",
  });

  const deduped = dedupeInsightsByAdSetDay(insights).filter(
    (r) => r.campaign_name && r.date_start,
  );
  logIngestionNormalizationSample(deduped);
  const dataRows = deduped.map(insightToManualCsvRow);

  let csvText = rowsToCsv([...META_CSV_HEADERS], dataRows);
  const inferredResultsTotal = sumResultsInMetaSyncCsv(csvText);
  const mergedWithManualReference = Boolean(input.referenceManualCsvText?.trim());

  if (mergedWithManualReference) {
    csvText = mergeApiCsvWithManualReference(csvText, input.referenceManualCsvText!);
  }

  const rowCount = Math.max(0, csvText.split("\n").filter(Boolean).length - 1);

  return { csvText, rowCount, sinceIso, untilIso, inferredResultsTotal, mergedWithManualReference };
}
