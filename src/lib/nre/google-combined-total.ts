import type { TableHeaderLabels, TableRowData } from "./report-data";

export const GOOGLE_TABLE_STATIC_HEADERS = ["Month", "Cost", "Clicks", "Impressions", "CTR", "Avg. CPC"] as const;

/** Google combined-total table — Cost/Clicks/Avg. CPC headers with optional previous-month period row. */
export function buildGoogleCombinedTotalTableGrid(
  periodRow: TableRowData,
  mtdRow: TableRowData,
  headers: TableHeaderLabels,
): string[][] {
  const headerRow = [...GOOGLE_TABLE_STATIC_HEADERS, ...headers.resultColumns.flatMap((c) => [c.label, c.costLabel])];
  const periodDataRow = periodRow.hasData
    ? [
        periodRow.monthLabel,
        periodRow.spend,
        periodRow.reach,
        periodRow.impressions,
        periodRow.ctr,
        periodRow.cpc,
        ...periodRow.resultColumns.flatMap((c) => [c.value, c.cprValue]),
      ]
    : ["—", "—", "—", "—", "—", "—", ...headers.resultColumns.flatMap(() => ["—", "—"])];
  const mtdDataRow = [
    mtdRow.monthLabel,
    mtdRow.spend,
    mtdRow.reach,
    mtdRow.impressions,
    mtdRow.ctr,
    mtdRow.cpc,
    ...mtdRow.resultColumns.flatMap((c) => [c.value, c.cprValue]),
  ];
  return [headerRow, mtdDataRow, periodDataRow];
}
