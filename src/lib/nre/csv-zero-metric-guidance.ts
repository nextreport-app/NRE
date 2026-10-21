/**
 * Meta CSV exports sometimes include metric headers with blank cells on every
 * row while delivery columns (spend, impressions) are populated. Slides then
 * show 0 — warn before generate/download.
 */

import type { ColumnMap, NreMetricKey, NreRow } from "./columns";
import { parseCellNum } from "./format";
import type { Platform } from "./google-columns";
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

function titleCaseMetricLabel(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return trimmed;
  return trimmed.replace(/\b\w+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

/** Dedupe Reach vs REACH; stable sort for display. */
export function uniqueMetricDisplayLabels(labels: string[]): string[] {
  const byKey = new Map<string, string>();
  for (const raw of labels) {
    const key = raw.trim().toLowerCase();
    if (!key || byKey.has(key)) continue;
    byKey.set(key, titleCaseMetricLabel(raw));
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b));
}

function formatMetricList(labels: string[]): string {
  if (labels.length <= 2) return labels.join(" and ");
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}

export function zeroMetricWarningsForLabels(labels: string[], platform: Platform = "META"): CsvZeroMetricWarning[] {
  const unique = uniqueMetricDisplayLabels(labels);
  if (unique.length === 0 || platform !== "META") return [];

  const count = unique.length;
  const title = count === 1 ? `${unique[0]} will show as 0` : `${count} metrics will show as 0`;
  const listPhrase = formatMetricList(unique);
  const message =
    count === 1
      ? `${unique[0]} is 0 on your slides — often a blank column in the Meta export. Re-export if that looks wrong, or generate anyway and manually edit it before sending the report to the client.`
      : `${listPhrase} are 0 on your slides — often blank columns in the Meta export. Re-export if that looks wrong, or generate anyway and manually edit it before sending the report to the client.`;

  return [
    {
      kind: count === 1 && unique[0]?.toLowerCase() === "reach" ? "missing_reach_values" : "missing_metric_values",
      title,
      message,
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
