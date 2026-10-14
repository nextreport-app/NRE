import type { MetaInsightRow } from "@/lib/meta-api";
import { manualExportPrimaryResult } from "./manual-export-mapper";

/** Manual Ads Manager daily CSV uses ISO dates in the Day column. */
export function normalizeDateFormat(dateStr: string): string {
  const trimmed = dateStr.trim();
  if (!trimmed) return "";
  const ddmmyyyy = /^(\d{2})-(\d{2})-(\d{4})$/;
  const match = trimmed.match(ddmmyyyy);
  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}`;
  }
  return trimmed;
}

/** Manual CSV stores CTR as a decimal percent (e.g. 3.26 meaning 3.26%), not a "6.02%" string. */
export function normalizePercentage(value: string | number | undefined): number {
  if (value === undefined || value === null || value === "") return 0;
  if (typeof value === "string" && value.trim().endsWith("%")) {
    return parseFloat(value.replace("%", "")) || 0;
  }
  const n = parseFloat(String(value));
  if (!Number.isFinite(n)) return 0;
  if (n > 0 && n <= 1) return n * 100;
  return n;
}

export function formatCtrForManualCsv(raw: string | undefined): string {
  const n = normalizePercentage(raw);
  return n > 0 ? String(n) : "";
}

/** API / export header labels → manual CSV column names the engine auto-map expects. */
export const API_TO_CSV_COLUMN_MAP: Record<string, string> = {
  "CPC (cost per link click)": "CPC (all)",
  "CTR (all)": "CTR (all)",
  "Cost per lead": "Cost per result",
  "Website leads": "Website leads",
  "Meta leads": "Meta leads",
};

export type NormalizedIngestionSample = {
  day: string;
  spend: number;
  ctr: number;
  results: number;
  resultType: string;
};

export function normalizedIngestionSample(row: MetaInsightRow): NormalizedIngestionSample {
  const primary = manualExportPrimaryResult(row);
  return {
    day: normalizeDateFormat(row.date_start ?? ""),
    spend: parseFloat(row.spend ?? "0") || 0,
    ctr: normalizePercentage(row.ctr),
    results: parseFloat(primary?.value ?? "0") || 0,
    resultType: primary?.csvResultType ?? "",
  };
}

const EXPECTED_FORMAT_HINT: NormalizedIngestionSample = {
  day: "2026-09-01",
  spend: 23.26,
  ctr: 6.02,
  results: 10,
  resultType: "website submission",
};

/** Logs the first rows after normalization — same shape manual CSV parsing produces. */
export function logIngestionNormalizationSample(insights: MetaInsightRow[], limit = 3): void {
  const slice = insights.slice(0, limit);
  if (slice.length === 0) return;
  console.info("[meta-api-sync] Expected format:   ", EXPECTED_FORMAT_HINT);
  for (const row of slice) {
    const sample = normalizedIngestionSample(row);
    console.info("[meta-api-sync] API row normalized:", sample);
    if (sample.results === 0 && (row.results?.length || row.objective_results?.length)) {
      console.info("[meta-api-sync] Mapper returned blank Results despite Meta result fields:", {
        day: sample.day,
        campaign: row.campaign_name,
        adset: row.adset_name,
        optimization_goal: row.optimization_goal,
        resultsIndicators: (row.results ?? []).map((r) => r.indicator),
        objectiveIndicators: (row.objective_results ?? []).map((r) => r.indicator),
        actionTypes: (row.actions ?? []).slice(0, 8).map((a) => a.action_type),
      });
    }
  }
}
