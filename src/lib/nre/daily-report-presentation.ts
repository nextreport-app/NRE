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
import { findMetaMetricByKey, type MetricFormat } from "./meta-dictionary";
import { parseCellNum } from "./format";
import type { DateRangeIso } from "./date-range";
export interface DailySummaryMetric {
  key: string;
  label: string;
  value: string;
}
export interface DailyTrendSeries {
  key: string;
  label: string;
  format: MetricFormat;
  points: { dateIso: string; value: number | null }[];
}
export interface DailyTrendPage {
  series: DailyTrendSeries[];
  startIso: string;
  endIso: string;
}
export interface DailyPresentation {
  summaryPages: DailySummaryMetric[][];
  trendPages: DailyTrendPage[];
  note: string;
}
export const DAILY_TABLE_METRICS_PER_PAGE = 7;
export const DAILY_TREND_DAYS_PER_PAGE = 31;
export function dailyMainTablePages(data: {
  tableSlides: TableRowData[][];
  tableHeaderLabels: TableHeaderLabels;
  dailyExcludedMetricKeys?: string[];
}) {
  const count = 6 + data.tableHeaderLabels.resultColumns.length * 2;
  const hidden = new Set(
    dailyHiddenColumns(
      data.tableHeaderLabels.resultColumns,
      data.dailyExcludedMetricKeys,
    ),
  );
  const columns = Array.from(
    { length: count - 1 },
    (_, index) => index + 1,
  ).filter((index) => !hidden.has(index));
  const pages: { rows: TableRowData[]; columns: number[] }[] = [];
  for (const rows of data.tableSlides)
    for (
      let index = 0;
      index < columns.length;
      index += DAILY_TABLE_METRICS_PER_PAGE
    )
      pages.push({
        rows,
        columns: [
          0,
          ...columns.slice(index, index + DAILY_TABLE_METRICS_PER_PAGE),
        ],
      });
  return pages;
}
const numeric = (text: string | undefined): number | null =>
  text && /\d/.test(text) ? parseCellNum(text) : null;
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
  const series: DailyTrendSeries[] = [];
  const byDate = new Map(
    input.dayRows
      .filter((row) => row.dateIso)
      .map((row) => [row.dateIso!, row]),
  );
  const days: string[] = [];
  for (
    let time = Date.parse(input.range.startIso);
    time <= Date.parse(input.range.endIso);
    time += 86400000
  )
    days.push(new Date(time).toISOString().slice(0, 10));
  let uniqueUnavailable = false;
  const add = (
    key: string,
    label: string,
    value: string,
    format: MetricFormat,
    dayValue: (row: TableRowData, iso: string) => number | null,
  ) => {
    if (dailyMetricIsExcluded(key, excluded)) return;
    summary.push({ key, label, value });
    series.push({
      key,
      label,
      format,
      points: days.map((dateIso) => ({
        dateIso,
        value: byDate.has(dateIso)
          ? dayValue(byDate.get(dateIso)!, dateIso)
          : null,
      })),
    });
  };
  add("spend", "AD SPEND", input.summaryRow.spend, "currency", (_, iso) =>
    (input.byDay.get(iso) ?? []).reduce(
      (sum, row) => sum + parseCellNum(row.spend),
      0,
    ),
  );
  if (!excluded.includes("reach")) uniqueUnavailable = true;
  add("reach", "REACH", "N/A", "number", (_, iso) => {
    const rows = input.byDay.get(iso) ?? [];
    return rows.length === 1 ? numeric(rows[0].reach) : null;
  });
  add(
    "impressions",
    "IMPRESSIONS",
    input.summaryRow.impressions,
    "number",
    (row) => numeric(row.impressions),
  );
  add("ctr", "CTR (ALL)", input.summaryRow.ctr, "percentage", (row) =>
    numeric(row.ctr),
  );
  add("cpc_all", "CPC (ALL)", input.summaryRow.cpc, "currency", (row) =>
    numeric(row.cpc),
  );
  for (const column of input.summaryRow.resultColumns) {
    const reach = column.label === "REACH";
    const resultKey = dailyObjectiveMetricKey(
        "objective_results",
        column.label,
      ),
      costKey = dailyObjectiveMetricKey("objective_cost", column.label);
    if (
      reach &&
      (!dailyMetricIsExcluded(resultKey, excluded) ||
        !dailyMetricIsExcluded(costKey, excluded))
    )
      uniqueUnavailable = true;
    add(
      resultKey,
      column.label,
      reach ? "N/A" : column.value,
      "number",
      (row, iso) =>
        reach && (input.byDay.get(iso)?.length ?? 0) !== 1
          ? null
          : numeric(
              row.resultColumns.find((value) => value.label === column.label)
                ?.value,
            ),
    );
    add(
      costKey,
      column.costLabel,
      reach ? "N/A" : column.cprValue,
      "currency",
      (row, iso) =>
        reach && (input.byDay.get(iso)?.length ?? 0) !== 1
          ? null
          : numeric(
              row.resultColumns.find((value) => value.label === column.label)
                ?.cprValue,
            ),
    );
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
  // Spend and objective results have separate axes; unrelated result types are never blended.
  let chosen = series
    .filter(
      (value) =>
        value.key === "spend" || value.key.startsWith("objective_results:"),
    )
    .filter((value) => value.points.some((point) => point.value !== null));
  if (!chosen.length)
    chosen = series
      .filter((value) => value.points.some((point) => point.value !== null))
      .slice(0, 1);
  const trendPages: DailyTrendPage[] = [];
  for (let day = 0; day < days.length; day += DAILY_TREND_DAYS_PER_PAGE)
    for (let index = 0; index < chosen.length; index += 2) {
      const part = days.slice(day, day + DAILY_TREND_DAYS_PER_PAGE);
      trendPages.push({
        startIso: part[0],
        endIso: part[part.length - 1],
        series: chosen
          .slice(index, index + 2)
          .map((value) => ({
            ...value,
            points: value.points.slice(day, day + DAILY_TREND_DAYS_PER_PAGE),
          })),
      });
    }
  return {
    summaryPages: paginateExtraMetrics(summary),
    trendPages,
    note: uniqueUnavailable
      ? "Rates are calculated for the whole period. Unique Reach and Frequency cannot be totaled from daily CSV rows; N/A means unavailable."
      : "Rates are calculated for the whole period, rather than averaged from daily rates.",
  };
}
