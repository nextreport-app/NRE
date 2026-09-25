import { fetchMetaAdAccountInsights } from "@/lib/meta-api";
import { computeLastNDaysIsoRange } from "../api-date-range";
import { rowsToCsv } from "../rows-to-csv";
import {
  META_CSV_HEADERS,
  dedupeInsightsByAdSetDay,
  insightToManualCsvRow,
} from "./insight-engine";

export interface FetchMetaReportCsvInput {
  accessToken: string;
  adAccountId: string;
  timezone: string;
  now?: Date;
  days?: number;
  /** When set, overrides the default last-N-days window (e.g. previous calendar month sync). */
  sinceIso?: string;
  untilIso?: string;
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

  const dataRows = dedupeInsightsByAdSetDay(insights)
    .filter((r) => r.campaign_name && r.date_start)
    .map(insightToManualCsvRow);

  const csvText = rowsToCsv([...META_CSV_HEADERS], dataRows);

  return { csvText, rowCount: dataRows.length, sinceIso, untilIso };
}
