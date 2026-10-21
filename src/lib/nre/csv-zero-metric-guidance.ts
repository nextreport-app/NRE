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
    `Re-export from ${manager} → Reports → Export table data with Time breakdown: Day, ` +
    `and confirm those columns show numbers in the preview before downloading.`
  );
}

export function csvZeroMetricWarnings(
  colMap: ColumnMap,
  rows: NreRow[],
  platform: Platform = "META",
): CsvZeroMetricWarning[] {
  const labels = detectBlankCsvMetricLabels(colMap, rows, platform);
  if (labels.length === 0) return [];

  if (labels.length === 1 && labels[0] === "Reach") {
    return [
      {
        kind: "missing_reach_values",
        title: "Reach is blank in this CSV",
        message:
          `Your file has delivery data but every Reach cell is empty, so Reach will show as 0 on slides. ${reExportHint(platform)}`,
        suggestedDownload: "last_30_days",
      },
    ];
  }

  const list = labels.join(", ");
  return [
    {
      kind: "missing_metric_values",
      title: labels.length === 1 ? `${labels[0]} will show as 0` : `${labels.length} metrics will show as 0`,
      message:
        labels.length === 1
          ? `Your file has delivery data but every ${labels[0]} cell is empty, so slides will show 0. ${reExportHint(platform)}`
          : `Your file has delivery data but these columns are blank on every row: ${list}. Those metrics will show as 0 on slides until you re-export. ${reExportHint(platform)}`,
      suggestedDownload: "last_30_days",
    },
  ];
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
