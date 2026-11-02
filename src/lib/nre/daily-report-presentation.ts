import { buildHistoricalComparisonTableGrid } from "./report-data";
import type { DailyExtraTable } from "./daily-extra-metrics";
import { dailyOptionalMetrics } from "./daily-extra-metrics";
import type { NreRow } from "./columns";
import type { TableHeaderLabels, TableRowData } from "./report-data";
import {
  dailyHiddenColumns,
  dailyMetricIsExcluded,
  dailyObjectiveMetricKey,
} from "./daily-metric-selection";
import { paginateExtraMetrics } from "./metric-pagination";
import { buildComparisonExtraMetrics } from "./comparison-extra-metrics";
import { findMetaMetricByKey } from "./meta-dictionary";
import type { DateRangeIso } from "./date-range";
export interface DailySummaryMetric {
  key: string;
  label: string;
  value: string;
}
export interface DailyPresentation {
  summaryPages: DailySummaryMetric[][];
  note: string;
}
export const DAILY_TABLE_METRICS_PER_PAGE = 7;

/** One ordered selection, paginated across days and columns; Date repeats on every page. */
export function dailyMainTablePages(data: {
  tableSlides: TableRowData[][];
  tableHeaderLabels: TableHeaderLabels;
  dailyExcludedMetricKeys?: string[];
  additionalTables?: DailyExtraTable[];
}) {
  const hidden = new Set(
    dailyHiddenColumns(
      data.tableHeaderLabels.resultColumns,
      data.dailyExcludedMetricKeys,
    ),
  );
  const extras = [
    ...new Map(
      (data.additionalTables ?? []).flatMap((table) =>
        table.metrics.map((metric) => [metric.key, metric] as const),
      ),
    ).values(),
  ];
  const values = new Map<string, Map<string, string>>();
  for (const table of data.additionalTables ?? [])
    for (const row of table.rows) {
      const day = values.get(row.date) ?? new Map<string, string>();
      table.metrics.forEach((metric, index) =>
        day.set(metric.key, row.values[index]),
      );
      values.set(row.date, day);
    }
  const count = 6 + data.tableHeaderLabels.resultColumns.length * 2;
  const columns = Array.from(
    { length: count - 1 },
    (_, index) => index + 1,
  ).filter((index) => !hidden.has(index));
  columns.push(...extras.map((_, index) => count + index));
  const pages: {
    rows: TableRowData[];
    columns: number[];
    grid: string[][];
    columnPage: number;
    columnPages: number;
  }[] = [];
  const columnPages = Math.ceil(columns.length / DAILY_TABLE_METRICS_PER_PAGE);
  for (const rows of data.tableSlides) {
    const grid = buildHistoricalComparisonTableGrid(
      rows,
      data.tableHeaderLabels,
    );
    grid[0][0] = "Date";
    grid[0].push(...extras.map((metric) => metric.label));
    rows
      .filter((row) => row.hasData)
      .forEach((row, index) => {
        grid[index + 1].push(
          ...extras.map(
            (metric) => values.get(row.monthLabel)?.get(metric.key) ?? "N/A",
          ),
        );
      });
    for (
      let offset = 0;
      offset < columns.length;
      offset += DAILY_TABLE_METRICS_PER_PAGE
    ) {
      const selected = [
        0,
        ...columns.slice(offset, offset + DAILY_TABLE_METRICS_PER_PAGE),
      ];
      pages.push({
        rows,
        columns: selected,
        grid: grid.map((row) => selected.map((column) => row[column])),
        columnPage: offset / DAILY_TABLE_METRICS_PER_PAGE + 1,
        columnPages,
      });
    }
  }
  return pages;
}

export function buildDailyPresentation(input: {
  byDay: Map<string, NreRow[]>;
  dayRows: TableRowData[];
  summaryRow: TableRowData;
  headers: string[];
  metricKeys?: string[];
  excluded?: string[];
  range: DateRangeIso;
  currencySymbol: string;
}): DailyPresentation | undefined {
  if (
    input.range.startIso === input.range.endIso ||
    !input.dayRows.some((row) => row.hasData)
  )
    return undefined;
  const excluded = input.excluded ?? [];
  const summary: DailySummaryMetric[] = [];
  let uniqueUnavailable = false;
  const add = (key: string, label: string, value: string) => {
    if (!dailyMetricIsExcluded(key, excluded))
      summary.push({ key, label, value });
  };
  add("spend", "AD SPEND", input.summaryRow.spend);
  if (!excluded.includes("reach")) uniqueUnavailable = true;
  add("reach", "REACH", "N/A");
  add("impressions", "IMPRESSIONS", input.summaryRow.impressions);
  add("ctr", "CTR (ALL)", input.summaryRow.ctr);
  add("cpc_all", "CPC (ALL)", input.summaryRow.cpc);
  for (const column of input.summaryRow.resultColumns) {
    const reach = column.label === "REACH";
    const resultKey = dailyObjectiveMetricKey(
      "objective_results",
      column.label,
    );
    const costKey = dailyObjectiveMetricKey("objective_cost", column.label);
    if (
      reach &&
      (!dailyMetricIsExcluded(resultKey, excluded) ||
        !dailyMetricIsExcluded(costKey, excluded))
    )
      uniqueUnavailable = true;
    add(resultKey, column.label, reach ? "N/A" : column.value);
    add(costKey, column.costLabel, reach ? "N/A" : column.cprValue);
  }
  const rows = [...input.byDay.values()].flat();
  const eligible = new Set(
    dailyOptionalMetrics(
      input.headers,
      input.summaryRow.resultColumns.map((column) => ({
        resultLabel: column.label,
        costLabel: column.costLabel,
      })),
      rows,
    ).map((metric) => metric.key),
  );
  for (const metric of buildComparisonExtraMetrics({
    rowsA: rows,
    rowsB: [],
    headers: input.headers,
    keys: input.metricKeys?.filter((key) => eligible.has(key)),
    platform: "META",
    currencySymbol: input.currencySymbol,
    objective: "",
    costLabel: "",
  })) {
    const definition = findMetaMetricByKey(metric.key);
    const unique =
      metric.key === "frequency" ||
      metric.key === "reach" ||
      definition?.perUnitOf === "reach";
    if (unique) uniqueUnavailable = true;
    summary.push({
      key: metric.key,
      label: metric.label,
      value: unique ? "N/A" : metric.formattedA,
    });
  }
  return {
    summaryPages: paginateExtraMetrics(summary),
    note: uniqueUnavailable
      ? "N/A indicates that a period total is unavailable."
      : "Figures cover the selected reporting period.",
  };
}
