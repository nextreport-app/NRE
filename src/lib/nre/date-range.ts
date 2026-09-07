/**
 * NRE v1 — date-range computation for the report upload wizard's date-range
 * step. Everything here is pure and works off already-parsed CSV rows; the
 * PPTX/aggregation layer (aggregate.ts's splitMtdDaily) consumes the same
 * "effective yesterday" definition so the wizard's displayed date options
 * and what actually gets aggregated can never drift apart.
 */

import { parseDate, getCalendarDateInTimezone, type ParsedDate } from "./dates";
import { getRowDate, type NreRow } from "./columns";

export function toIsoDate(d: ParsedDate): string {
  return `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
}

function tsOf(d: ParsedDate): number {
  return Date.UTC(d.year, d.month - 1, d.day);
}

function dateFromTs(ts: number): ParsedDate {
  const d = new Date(ts);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function addDays(d: ParsedDate, days: number): ParsedDate {
  return dateFromTs(tsOf(d) + days * 24 * 60 * 60 * 1000);
}

/**
 * The last day of data to actually use: the latest date present in the
 * rows, capped at real yesterday (today's data is always incomplete, and a
 * CSV exported a few days ago shouldn't pretend to have data it doesn't).
 * This is the single definition of "yesterday" shared by every date-range
 * helper below and by aggregate.ts's splitMtdDaily.
 */
export function computeEffectiveYesterday(
  rows: NreRow[],
  now: Date = new Date(),
  timezone = "UTC",
): ParsedDate | null {
  let latestTs: number | null = null;
  rows.forEach((row) => {
    const d = parseDate(getRowDate(row));
    if (!d) return;
    const ts = tsOf(d);
    if (latestTs === null || ts > latestTs) latestTs = ts;
  });
  if (latestTs === null) return null;

  const yesterdayInTz = addDays(getCalendarDateInTimezone(now, timezone), -1);
  const yesterdayTs = tsOf(yesterdayInTz);
  return dateFromTs(Math.min(latestTs, yesterdayTs));
}

export interface DateRangeIso {
  startIso: string;
  endIso: string;
}

export interface WeeklyRangeOptions {
  last7: DateRangeIso;
  prev7: DateRangeIso;
}

/** "Last 7 days ending calendar yesterday" and the 7 days before that — anchored to the client's timezone, not the CSV's latest row. */
export function computeWeeklyRangeOptions(
  _rows: NreRow[],
  now: Date = new Date(),
  timezone = "UTC",
): WeeklyRangeOptions {
  const calendarYesterday = getCalendarYesterday(now, timezone);
  const last7Start = addDays(calendarYesterday, -6);
  const prev7End = addDays(last7Start, -1);
  const prev7Start = addDays(prev7End, -6);
  return {
    last7: { startIso: toIsoDate(last7Start), endIso: toIsoDate(calendarYesterday) },
    prev7: { startIso: toIsoDate(prev7Start), endIso: toIsoDate(prev7End) },
  };
}

function daysInMonth(year: number, month: number): number {
  // Day 0 of "next month" is the last day of `month` itself.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export interface MonthComparisonRangeOptions {
  periodA: DateRangeIso;
  periodB: DateRangeIso;
}

/**
 * "This month vs Last month" comparison-report preset (see report-data.ts's
 * buildComparisonReportData): Period A is day 1 of the reporting month
 * through yesterday; Period B is the identical day-of-month span exactly
 * one calendar month earlier (e.g. Aug 1-6 vs Jul 1-6). When yesterday's
 * day-of-month doesn't exist in the prior month (e.g. yesterday = Mar 31),
 * Period B's end clamps to that shorter month's own last day (Feb 28/29)
 * rather than overflowing into March.
 */
export function computeMonthComparisonRangeOptions(
  rows: NreRow[],
  now: Date = new Date(),
  timezone = "UTC",
): MonthComparisonRangeOptions | null {
  const yesterday = computeEffectiveYesterday(rows, now, timezone);
  if (!yesterday) return null;
  const periodAStart: ParsedDate = { year: yesterday.year, month: yesterday.month, day: 1 };

  let prevMonth = yesterday.month - 1;
  let prevYear = yesterday.year;
  if (prevMonth < 1) {
    prevMonth = 12;
    prevYear -= 1;
  }
  const prevMonthLastDay = daysInMonth(prevYear, prevMonth);
  const periodBEnd: ParsedDate = { year: prevYear, month: prevMonth, day: Math.min(yesterday.day, prevMonthLastDay) };
  const periodBStart: ParsedDate = { year: prevYear, month: prevMonth, day: 1 };

  return {
    periodA: { startIso: toIsoDate(periodAStart), endIso: toIsoDate(yesterday) },
    periodB: { startIso: toIsoDate(periodBStart), endIso: toIsoDate(periodBEnd) },
  };
}

/** Single-day window — yesterday (or latest complete day in the CSV). Used by Daily reports. */
export function computeDailyRangeIso(rows: NreRow[], now: Date = new Date(), timezone = "UTC"): DateRangeIso | null {
  const yesterday = computeEffectiveYesterday(rows, now, timezone);
  if (!yesterday) return null;
  const iso = toIsoDate(yesterday);
  return { startIso: iso, endIso: iso };
}

/** Default creative analysis window — trailing 30 days ending yesterday. */
export function computeCreativeRangeIso(
  rows: NreRow[],
  now: Date = new Date(),
  days = 30,
  timezone = "UTC",
): DateRangeIso | null {
  const yesterday = computeEffectiveYesterday(rows, now, timezone);
  if (!yesterday) return null;
  const start = addDays(yesterday, -(days - 1));
  return { startIso: toIsoDate(start), endIso: toIsoDate(yesterday) };
}

/** Yesterday in the client's calendar — independent of which dates appear in the CSV. */
export function getCalendarYesterday(now: Date = new Date(), timezone = "UTC"): ParsedDate {
  return addDays(getCalendarDateInTimezone(now, timezone), -1);
}

/**
 * MTD window for labels and filtering: day 1 of the current calendar month
 * (in the client's timezone) through calendar yesterday. Anchored to the
 * real reporting month, NOT the latest month present in the CSV — so a Last
 * 30 Days export that still only has last month's rows on the 2nd never
 * mis-labels August totals as September MTD.
 */
export function computeMtdRangeIso(_rows: NreRow[], now: Date = new Date(), timezone = "UTC"): DateRangeIso {
  const calendarYesterday = getCalendarYesterday(now, timezone);
  const monthStart: ParsedDate = { year: calendarYesterday.year, month: calendarYesterday.month, day: 1 };
  return { startIso: toIsoDate(monthStart), endIso: toIsoDate(calendarYesterday) };
}

export interface CsvDateBounds {
  minIso: string;
  maxIso: string;
}

/** The actual min/max dates present anywhere in the uploaded CSV — bounds the custom date pickers. */
export function computeCsvDateBounds(rows: NreRow[]): CsvDateBounds | null {
  let minTs: number | null = null;
  let maxTs: number | null = null;
  rows.forEach((row) => {
    const d = parseDate(getRowDate(row));
    if (!d) return;
    const ts = tsOf(d);
    if (minTs === null || ts < minTs) minTs = ts;
    if (maxTs === null || ts > maxTs) maxTs = ts;
  });
  if (minTs === null || maxTs === null) return null;
  return { minIso: toIsoDate(dateFromTs(minTs)), maxIso: toIsoDate(dateFromTs(maxTs)) };
}

export interface CustomRangeValidation {
  valid: boolean;
  error?: string;
  spanDays?: number;
}

export interface HistoricalMonthRange extends DateRangeIso {
  /** Full month name, e.g. "May". */
  monthName: string;
  year: number;
  /** Slide header chrome, e.g. "YOUR MAY PERFORMANCE REPORT". */
  performanceHeader: string;
  /** Human label for cover/summary, e.g. "May 2025". */
  fullMonthLabel: string;
}

/**
 * Last N complete calendar months ending before the current (partial) month —
 * anchored to the client's timezone. E.g. on Sep 7 with monthCount=4 → May,
 * Jun, Jul, Aug (oldest first).
 */
export function computeHistoricalMonthRanges(
  monthCount: number,
  now: Date = new Date(),
  timezone = "UTC",
): HistoricalMonthRange[] {
  if (monthCount < 1) return [];

  const calendarYesterday = getCalendarYesterday(now, timezone);
  let year = calendarYesterday.year;
  let month = calendarYesterday.month;

  const ranges: HistoricalMonthRange[] = [];
  for (let i = 0; i < monthCount; i++) {
    month -= 1;
    if (month < 1) {
      month = 12;
      year -= 1;
    }
    const lastDay = daysInMonth(year, month);
    const monthName = new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" }).format(
      new Date(Date.UTC(year, month - 1, 1)),
    );
    ranges.unshift({
      startIso: toIsoDate({ year, month, day: 1 }),
      endIso: toIsoDate({ year, month, day: lastDay }),
      monthName,
      year,
      performanceHeader: `YOUR ${monthName.toUpperCase()} PERFORMANCE REPORT`,
      fullMonthLabel: `${monthName} ${year}`,
    });
  }
  return ranges;
}

/** Ensures the uploaded CSV spans every requested historical month. */
export function validateHistoricalCsvCoverage(
  bounds: CsvDateBounds,
  monthRanges: HistoricalMonthRange[],
): CustomRangeValidation {
  if (monthRanges.length === 0) {
    return { valid: false, error: "Choose at least one month." };
  }
  const first = monthRanges[0];
  const last = monthRanges[monthRanges.length - 1];

  const minTs = Date.parse(bounds.minIso + "T00:00:00Z");
  const maxTs = Date.parse(bounds.maxIso + "T00:00:00Z");
  const missing: string[] = [];
  for (const range of monthRanges) {
    const startTs = Date.parse(range.startIso + "T00:00:00Z");
    const endTs = Date.parse(range.endIso + "T00:00:00Z");
    const overlaps = minTs <= endTs && maxTs >= startTs;
    if (!overlaps) {
      missing.push(range.fullMonthLabel);
    }
  }
  if (missing.length > 0) {
    return {
      valid: false,
      error: `Your CSV is missing data for: ${missing.join(", ")}. Export one daily CSV covering ${first.fullMonthLabel} through ${last.fullMonthLabel}.`,
    };
  }
  return { valid: true };
}

/**
 * Anchor `now` for a complete historical calendar month so splitMtdDaily's
 * "calendar yesterday" falls on that month's last day (not the day before).
 * E.g. May 2026 → Jun 1 noon UTC → yesterday = May 31.
 */
export function historicalMonthNowAnchor(endIso: string): Date {
  const [year, month, day] = endIso.split("-").map(Number);
  const nextDay = addDays({ year, month, day }, 1);
  return new Date(`${toIsoDate(nextDay)}T12:00:00Z`);
}

/** Filters parsed CSV rows to an inclusive ISO date window. */
export function filterNreRowsByDateRange<T extends NreRow>(rows: T[], range: DateRangeIso): T[] {
  const startTs = Date.parse(range.startIso + "T00:00:00Z");
  const endTs = Date.parse(range.endIso + "T00:00:00Z");
  return rows.filter((row) => {
    const d = parseDate(getRowDate(row));
    if (!d) return false;
    const ts = Date.UTC(d.year, d.month - 1, d.day);
    return ts >= startTs && ts <= endTs;
  });
}

/** Validates a user-picked custom weekly range against what's actually in the CSV. */
export function validateCustomWeeklyRange(
  startIso: string,
  endIso: string,
  bounds: CsvDateBounds,
): CustomRangeValidation {
  const startTs = Date.parse(startIso + "T00:00:00Z");
  const endTs = Date.parse(endIso + "T00:00:00Z");
  if (Number.isNaN(startTs) || Number.isNaN(endTs)) {
    return { valid: false, error: "Invalid date." };
  }
  if (startTs > endTs) {
    return { valid: false, error: "Start date must be before end date." };
  }
  const minTs = Date.parse(bounds.minIso + "T00:00:00Z");
  const maxTs = Date.parse(bounds.maxIso + "T00:00:00Z");
  if (startTs < minTs || endTs > maxTs) {
    return {
      valid: false,
      error: `The uploaded CSV only has data from ${bounds.minIso} to ${bounds.maxIso}. Choose dates within that range.`,
    };
  }
  const spanDays = Math.round((endTs - startTs) / (24 * 60 * 60 * 1000)) + 1;
  return { valid: true, spanDays };
}
