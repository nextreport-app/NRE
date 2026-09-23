/**
 * Day-by-Day Performance reports — account-level totals per calendar day in a
 * custom date range, rendered as paginated Combined Total table slides.
 */

import type { NreRow } from "./columns";
import { getRowDate } from "./columns";
import { filterRowsByCampaigns } from "./campaigns";
import { parseDate } from "./dates";
import {
  computeCsvDateBounds,
  filterNreRowsByDateRange,
  toIsoDate,
  type DateRangeIso,
  validateCustomWeeklyRange,
} from "./date-range";
import { aggregateRows } from "./aggregate";
import { buildCampaignObjectiveMap } from "./objective";
import {
  buildAggregatedTableRow,
  type Platform,
  type TableHeaderLabels,
  type TableRowData,
} from "./report-data";
import type { SelectedMetric } from "./available-metrics";

/** Rows per table slide — within the 7–10 product range. */
export const DAY_BREAKDOWN_ROWS_PER_SLIDE = 8;

export interface DayBreakdownReportData {
  isPaused: boolean;
  accountName: string;
  reportDate: string;
  /** e.g. "Jun 20 - Jun 26, 2026" */
  rangeLabel: string;
  dateRange: DateRangeIso;
  dayCount: number;
  /** One row per day, oldest first. */
  dayRows: TableRowData[];
  /** dayRows chunked for slide pagination. */
  tableSlides: TableRowData[][];
  tableHeaderLabels: TableHeaderLabels;
  platform: Platform;
}

export interface BuildDayBreakdownReportDataInput {
  accountName: string;
  currencySymbol: string;
  timezone: string;
  mtdDailyRows: NreRow[];
  dateRange: DateRangeIso;
  selectedCampaigns?: string[] | null;
  selectedMetrics?: SelectedMetric[];
  campaignObjectives?: Record<string, { resultLabel: string; costLabel: string }>;
  campaignMetricOverrides?: Record<string, string[]>;
  objectiveCache?: Record<string, { resultLabel: string; costLabel: string; key: string }>;
  now?: Date;
  platform?: Platform;
}

export interface DayBreakdownValidationResult {
  valid: boolean;
  error?: string;
  spanDays?: number;
}

function formatIsoDayLabel(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

function formatRangeLabel(range: DateRangeIso): string {
  const start = formatIsoDayLabel(range.startIso);
  const end = formatIsoDayLabel(range.endIso);
  if (range.startIso === range.endIso) return start;
  const year = new Date(range.endIso + "T00:00:00Z").getUTCFullYear();
  const startShort = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(range.startIso + "T00:00:00Z"));
  const endShort = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(range.endIso + "T00:00:00Z"));
  return `${startShort} - ${endShort}, ${year}`;
}

function rowDayIso(row: NreRow): string | null {
  const parsed = parseDate(getRowDate(row));
  return parsed ? toIsoDate(parsed) : null;
}

function unionTableHeaderLabels(rows: TableRowData[]): TableHeaderLabels {
  const seenLabels = new Set<string>();
  const resultColumns: { label: string; costLabel: string }[] = [];
  for (const row of rows) {
    if (!row.hasData) continue;
    for (const col of row.resultColumns) {
      if (seenLabels.has(col.label)) continue;
      seenLabels.add(col.label);
      resultColumns.push({ label: col.label, costLabel: col.costLabel });
    }
  }
  return { resultColumns };
}

export function paginateDayBreakdownRows(rows: TableRowData[], rowsPerSlide = DAY_BREAKDOWN_ROWS_PER_SLIDE): TableRowData[][] {
  const dataRows = rows.filter((row) => row.hasData);
  if (dataRows.length === 0) return [];
  const slides: TableRowData[][] = [];
  for (let i = 0; i < dataRows.length; i += rowsPerSlide) {
    slides.push(dataRows.slice(i, i + rowsPerSlide));
  }
  return slides;
}

export function validateDayBreakdownReportInput(
  mtdDailyRows: NreRow[],
  dateRange: DateRangeIso,
): DayBreakdownValidationResult {
  const bounds = computeCsvDateBounds(mtdDailyRows);
  if (!bounds) {
    return { valid: false, error: "Could not read any dates from the uploaded CSV." };
  }
  const validation = validateCustomWeeklyRange(dateRange.startIso, dateRange.endIso, bounds);
  if (!validation.valid) {
    return { valid: false, error: validation.error || "Invalid date range." };
  }
  return { valid: true, spanDays: validation.spanDays };
}

export function buildDayBreakdownReportData(input: BuildDayBreakdownReportDataInput): DayBreakdownReportData {
  const {
    accountName,
    currencySymbol,
    timezone,
    mtdDailyRows,
    dateRange,
    selectedCampaigns,
    now = new Date(),
    platform = "META",
  } = input;

  const campaignFilteredRows = filterRowsByCampaigns(mtdDailyRows, selectedCampaigns ?? null);
  const rowsInRange = filterNreRowsByDateRange(campaignFilteredRows, dateRange);

  const byDay = new Map<string, NreRow[]>();
  for (const row of rowsInRange) {
    const dayIso = rowDayIso(row);
    if (!dayIso) continue;
    const bucket = byDay.get(dayIso) ?? [];
    bucket.push(row);
    byDay.set(dayIso, bucket);
  }

  const sortedDayIsos = [...byDay.keys()].sort();
  const aggRows = sortedDayIsos.map((dayIso) => aggregateRows(byDay.get(dayIso) ?? []));
  const objectiveMap = buildCampaignObjectiveMap(aggRows.flat());

  const dayRows: TableRowData[] = sortedDayIsos.map((dayIso, index) => {
    const row = buildAggregatedTableRow(aggRows[index] ?? [], currencySymbol, objectiveMap, timezone);
    const dayLabel = formatIsoDayLabel(dayIso);
    return row.hasData
      ? { ...row, monthLabel: dayLabel, fullMonthLabel: dayLabel, monthName: null, sameMonthAsCurrentMTD: false }
      : row;
  });

  const tableHeaderLabels = unionTableHeaderLabels(dayRows);
  const tableSlides = paginateDayBreakdownRows(dayRows);

  const reportDateParts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  })
    .formatToParts(now)
    .reduce(
      (acc, part) => {
        if (part.type === "month") acc.month = part.value;
        if (part.type === "day") acc.day = part.value;
        if (part.type === "year") acc.year = part.value;
        return acc;
      },
      { month: "", day: "", year: "" } as { month: string; day: string; year: string },
    );

  return {
    isPaused: dayRows.every((row) => !row.hasData),
    accountName,
    reportDate: `${reportDateParts.month}-${reportDateParts.day}-${reportDateParts.year}`,
    rangeLabel: formatRangeLabel(dateRange),
    dateRange,
    dayCount: dayRows.filter((row) => row.hasData).length,
    dayRows,
    tableSlides,
    tableHeaderLabels,
    platform,
  };
}
