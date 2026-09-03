import { searchGoogleAds, type GoogleAdsSearchRow } from "@/lib/google-ads-api";
import { computeLastNDaysIsoRange } from "./api-date-range";
import { isoToCsvDay, rowsToCsv } from "./rows-to-csv";

const GOOGLE_CSV_HEADERS = ["Campaign", "Day", "Cost", "Clicks", "Impr.", "CTR", "Avg. CPC"] as const;

function formatMicrosCost(micros: string | undefined): string {
  if (!micros) return "0";
  const n = Number(micros);
  if (!Number.isFinite(n)) return "0";
  return (n / 1_000_000).toFixed(2);
}

function formatCtr(ctr: number | undefined): string {
  if (ctr === undefined || ctr === null) return "";
  return `${(ctr * 100).toFixed(2)}%`;
}

function formatAvgCpc(micros: number | undefined): string {
  if (micros === undefined || micros === null) return "";
  return (micros / 1_000_000).toFixed(2);
}

function searchRowToCsvRow(row: GoogleAdsSearchRow): string[] {
  const metrics = row.metrics ?? {};
  const costMicros = metrics.costMicros ?? metrics.cost_micros;
  const avgCpc = metrics.averageCpc ?? metrics.average_cpc;

  return [
    row.campaign?.name ?? "",
    row.segments?.date ? isoToCsvDay(row.segments.date) : "",
    formatMicrosCost(costMicros),
    metrics.clicks ?? "0",
    metrics.impressions ?? "0",
    formatCtr(metrics.ctr),
    formatAvgCpc(avgCpc),
  ];
}

export interface FetchGoogleReportCsvInput {
  accessToken: string;
  customerId: string;
  timezone: string;
  now?: Date;
  days?: number;
  loginCustomerId?: string;
}

/** Fetches Google Ads campaign metrics via GAQL and serializes to CSV bytes. */
export async function fetchGoogleReportCsv(input: FetchGoogleReportCsvInput): Promise<{
  csvText: string;
  rowCount: number;
  sinceIso: string;
  untilIso: string;
}> {
  const { sinceIso, untilIso } = computeLastNDaysIsoRange(
    input.now ?? new Date(),
    input.timezone,
    input.days ?? 30,
  );

  const query = `
    SELECT
      campaign.name,
      segments.date,
      metrics.cost_micros,
      metrics.clicks,
      metrics.impressions,
      metrics.ctr,
      metrics.average_cpc
    FROM campaign
    WHERE segments.date BETWEEN '${sinceIso}' AND '${untilIso}'
      AND metrics.impressions > 0
    ORDER BY segments.date
  `.trim();

  const results = await searchGoogleAds({
    accessToken: input.accessToken,
    customerId: input.customerId,
    query,
    loginCustomerId: input.loginCustomerId,
  });

  const dataRows = results
    .filter((r) => r.campaign?.name && r.segments?.date)
    .map(searchRowToCsvRow);

  const csvText = rowsToCsv([...GOOGLE_CSV_HEADERS], dataRows);

  return { csvText, rowCount: dataRows.length, sinceIso, untilIso };
}

export { GOOGLE_CSV_HEADERS };
