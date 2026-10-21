/**
 * Meta CSV exports sometimes include metric headers with blank cells on every
 * row while delivery columns (spend, impressions) are populated. Slides then
 * show 0 — warn before generate/download.
 */

import type { ColumnMap, NreMetricKey, NreRow } from "./columns";
import { parseCellNum } from "./format";
import type { Platform } from "./google-columns";
import { adsManagerName } from "./platform-reporting";
import type { CsvDateWarning } from "./csv-date-guidance";
import type { ReportData } from "./report-data";
import { collectZeroMetricLabelsFromReport } from "./report-zero-metric-warnings";

export type CsvZeroMetricWarning = CsvDateWarning & { kind: "missing_metric_values" | "missing_reach_values" };

type MetricRule = {
  key: NreMetricKey;
  label: string;
  /** When true and the column is all blank/zero, flag this metric. */
  shouldWarn: (rows: NreRow[], colMap: ColumnMap) => boolean;
};

/** True when the column exists and every row parses to 0 / blank. */
export function csvColumnPresentButAllZero(colMap: ColumnMap, rows: NreRow[], key: NreMetricKey): boolean {
  if (!colMap[key] || rows.length === 0) return false;
  for (const row of rows) {
    if (parseCellNum(row[key]) > 0) return false;
  }
  return true;
}

function rowsHaveSpend(rows: NreRow[]): boolean {
  return rows.some((r) => parseCellNum(r.spend) > 0);
}

function rowsHaveImpressions(rows: NreRow[]): boolean {
  return rows.some((r) => parseCellNum(r.impressions) > 0);
}

function rowsHaveCtrSignal(rows: NreRow[]): boolean {
  return rows.some((r) => parseCellNum(r.ctr) > 0);
}

const META_ZERO_METRIC_RULES: MetricRule[] = [
  {
    key: "reach",
    label: "Reach",
    shouldWarn: (rows) => rowsHaveImpressions(rows),
  },
  {
    key: "frequency",
    label: "Frequency",
    shouldWarn: (rows) => rowsHaveImpressions(rows),
  },
  {
    key: "impressions",
    label: "Impressions",
    shouldWarn: (rows) => rowsHaveSpend(rows),
  },
  {
    key: "link_clicks",
    label: "Link clicks",
    shouldWarn: (rows) => rowsHaveImpressions(rows) && rowsHaveCtrSignal(rows),
  },
  {
    key: "spend",
    label: "Amount spent",
    shouldWarn: (rows) => rowsHaveImpressions(rows) || rows.some((r) => parseCellNum(r.results) > 0),
  },
];

export function filterRowsForCampaignSelection(rows: NreRow[], selectedCampaigns?: string[] | null): NreRow[] {
  if (!selectedCampaigns?.length) return rows;
  const allowed = new Set(selectedCampaigns.map((c) => c.trim()).filter(Boolean));
  if (allowed.size === 0) return rows;
  return rows.filter((r) => allowed.has(String(r.campaign_name || "").trim()));
}

/** Metric display labels that will show as 0 because the CSV column is entirely blank. */
export function detectBlankCsvMetricLabels(
  colMap: ColumnMap,
  rows: NreRow[],
  platform: Platform = "META",
): string[] {
  if (platform !== "META" || rows.length === 0) return [];
  const labels: string[] = [];
  for (const rule of META_ZERO_METRIC_RULES) {
    if (!csvColumnPresentButAllZero(colMap, rows, rule.key)) continue;
    if (!rule.shouldWarn(rows, colMap)) continue;
    labels.push(rule.label);
  }
  return labels;
}

function reExportHint(platform: Platform): string {
  const manager = adsManagerName(platform);
  return (
    `If that looks wrong, re-export from ${manager} → Reports → Export table data with Time breakdown: Day ` +
    `(Reach is sometimes missing from Meta exports even when Impressions are present).`
  );
}

function uniqueSortedLabels(labels: string[]): string[] {
  return [...new Set(labels.map((l) => l.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function zeroMetricWarningsForLabels(labels: string[], platform: Platform = "META"): CsvZeroMetricWarning[] {
  const unique = uniqueSortedLabels(labels);
  if (unique.length === 0 || platform !== "META") return [];

  const list = unique.join(", ");

  if (unique.length === 1 && unique[0] === "Reach") {
    return [
      {
        kind: "missing_reach_values",
        title: "Reach will show as 0 on your slides",
        message:
          `Your report preview has Reach at 0 while other delivery metrics have data. ${reExportHint(platform)} You can still generate and double-check before sharing with your client.`,
        suggestedDownload: "last_30_days",
      },
    ];
  }

  return [
    {
      kind: "missing_metric_values",
      title: unique.length === 1 ? `${unique[0]} will show as 0` : `${unique.length} metrics will show as 0`,
      message:
        unique.length === 1
          ? `Your report preview shows ${unique[0]} as 0 on campaign/ad set slides while spend or delivery metrics are non-zero. ${reExportHint(platform)} Review before sharing, or generate anyway if that is expected.`
          : `Your report preview shows these metrics as 0 on slides: ${list}. ${reExportHint(platform)} Review before sharing, or generate anyway if that is expected.`,
      suggestedDownload: "last_30_days",
    },
  ];
}

export function csvZeroMetricWarnings(
  colMap: ColumnMap,
  rows: NreRow[],
  platform: Platform = "META",
): CsvZeroMetricWarning[] {
  return zeroMetricWarningsForLabels(detectBlankCsvMetricLabels(colMap, rows, platform), platform);
}

/** CSV blank columns + built report preview zeros (Generate-step source of truth). */
export function combinedZeroMetricWarnings(
  colMap: ColumnMap,
  rows: NreRow[],
  report: ReportData | null | undefined,
  platform: Platform = "META",
): CsvZeroMetricWarning[] {
  const fromCsv = detectBlankCsvMetricLabels(colMap, rows, platform);
  const fromReport = report ? collectZeroMetricLabelsFromReport(report) : [];
  return zeroMetricWarningsForLabels([...fromCsv, ...fromReport], platform);
}

/** @deprecated Use csvColumnPresentButAllZero(colMap, rows, "reach") */
export function csvReachColumnPresentButEmpty(colMap: ColumnMap, rows: NreRow[]): boolean {
  return csvColumnPresentButAllZero(colMap, rows, "reach") && rowsHaveImpressions(rows);
}

/** @deprecated Use csvZeroMetricWarnings */
export function missingReachValuesWarning(
  colMap: ColumnMap,
  rows: NreRow[],
  platform: Platform = "META",
): CsvDateWarning | null {
  const warnings = csvZeroMetricWarnings(colMap, rows, platform);
  return warnings[0] ?? null;
}
