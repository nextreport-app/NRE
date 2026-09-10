import { fetchTikTokIntegratedReport } from "@/lib/tiktok-api";
import { computeLastNDaysIsoRange } from "./api-date-range";
import { isoToCsvDay, rowsToCsv } from "./rows-to-csv";

/** Meta-compatible CSV headers so TikTok reuses the existing NRE Meta pipeline. */
const TIKTOK_AS_META_CSV_HEADERS = [
  "Campaign name",
  "Ad set name",
  "Day",
  "Amount spent (USD)",
  "Reach",
  "Impressions",
  "CTR (All)",
  "CPC (cost per link click)",
  "Link clicks",
  "Frequency",
  "Results",
  "Result type",
  "Cost per result",
] as const;

function formatPercent(raw: string | undefined): string {
  if (!raw) return "";
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return raw;
  const pct = n <= 1 && n > 0 ? n * 100 : n;
  return `${pct.toFixed(2)}%`;
}

function formatMoney(raw: string | undefined): string {
  if (!raw) return "0";
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return raw;
  return n.toFixed(2);
}

function tiktokRowToCsvRow(row: { dimensions?: Record<string, string>; metrics?: Record<string, string> }): string[] {
  const m = row.metrics ?? {};
  const d = row.dimensions ?? {};
  const conversions = m.conversion ?? "";
  const hasConversions = conversions && parseFloat(conversions) > 0;

  return [
    m.campaign_name ?? "",
    m.adgroup_name ?? "",
    d.stat_time_day ? isoToCsvDay(d.stat_time_day.slice(0, 10)) : "",
    formatMoney(m.spend),
    m.reach ?? "",
    m.impressions ?? "",
    formatPercent(m.ctr),
    formatMoney(m.cpc),
    m.clicks ?? "",
    m.frequency ?? "",
    hasConversions ? conversions : m.clicks ?? "",
    hasConversions ? "Conversions" : "Link clicks",
    hasConversions ? formatMoney(m.cost_per_conversion) : formatMoney(m.cpc),
  ];
}

export interface FetchTikTokReportCsvInput {
  accessToken: string;
  advertiserId: string;
  timezone: string;
  now?: Date;
  days?: number;
  /** When set, overrides the default last-N-days window (e.g. previous calendar month sync). */
  sinceIso?: string;
  untilIso?: string;
}

export interface FetchTikTokReportCsvResult {
  csvText: string;
  rowCount: number;
  sinceIso: string;
  untilIso: string;
}

/** Fetches TikTok ad-group daily insights and returns Meta-shaped CSV for the NRE pipeline. */
export async function fetchTikTokReportCsv(input: FetchTikTokReportCsvInput): Promise<FetchTikTokReportCsvResult> {
  const { sinceIso, untilIso } =
    input.sinceIso && input.untilIso
      ? { sinceIso: input.sinceIso, untilIso: input.untilIso }
      : computeLastNDaysIsoRange(input.now ?? new Date(), input.timezone, input.days ?? 30);

  const apiRows = await fetchTikTokIntegratedReport({
    accessToken: input.accessToken,
    advertiserId: input.advertiserId,
    startDate: sinceIso,
    endDate: untilIso,
  });

  const csvRows = apiRows.map(tiktokRowToCsvRow).filter((row) => row.some((cell) => cell !== ""));
  const csvText = rowsToCsv([...TIKTOK_AS_META_CSV_HEADERS], csvRows);

  return {
    csvText,
    rowCount: csvRows.length,
    sinceIso,
    untilIso,
  };
}

export { TIKTOK_AS_META_CSV_HEADERS };
