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

/** "Last 7 days ending yesterday" and the 7 days immediately before that, as actual dates. */
export function computeWeeklyRangeOptions(
  rows: NreRow[],
  now: Date = new Date(),
  timezone = "UTC",
): WeeklyRangeOptions | null {
  const yesterday = computeEffectiveYesterday(rows, now, timezone);
  if (!yesterday) return null;
  const last7Start = addDays(yesterday, -6);
  const prev7End = addDays(last7Start, -1);
  const prev7Start = addDays(prev7End, -6);
  return {
    last7: { startIso: toIsoDate(last7Start), endIso: toIsoDate(yesterday) },
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
