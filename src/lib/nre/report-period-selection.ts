/** Shared report-period rules for the picker, preview and generation. */
import type { DateSelection } from "@/lib/validators/report-wizard";
import { getCalendarDateInTimezone } from "./dates";
import { type DateRangeIso } from "./date-range";

export function reportCalendarYesterday(now = new Date(), timezone = "UTC"): string {
  const d = getCalendarDateInTimezone(now, timezone);
  return new Date(Date.UTC(d.year, d.month - 1, d.day - 1)).toISOString().slice(0, 10);
}

export function monthPeriod(month: string, now = new Date(), timezone = "UTC"): DateRangeIso {
  const yesterday = reportCalendarYesterday(now, timezone);
  const [year, m] = month.split("-").map(Number);
  const end = new Date(Date.UTC(year, m, 0)).toISOString().slice(0, 10);
  return { startIso: `${month}-01`, endIso: end > yesterday ? yesterday : end };
}

/** Anchor a monthly engine to the calendar day following the selected end. */
export function reportPeriodAnchor(endIso: string, timezone: string): Date {
  const target = new Date(`${endIso}T12:00:00Z`);
  target.setUTCDate(target.getUTCDate() + 1);
  const local = getCalendarDateInTimezone(target, timezone);
  const localTs = Date.UTC(local.year, local.month - 1, local.day);
  const targetTs = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate());
  return new Date(target.getTime() + targetTs - localTs);
}

export function selectedSinglePeriod(type: string, selection: DateSelection | undefined, now = new Date(), timezone = "UTC"): DateRangeIso | undefined {
  if (type !== "MONTHLY" && type !== "DAILY") return undefined;
  const yesterday = reportCalendarYesterday(now, timezone);
  const today = getCalendarDateInTimezone(now, timezone);
  const currentMonth = `${today.year}-${String(today.month).padStart(2, "0")}`;
  const fallback = type === "DAILY" ? { startIso: yesterday, endIso: yesterday } : monthPeriod(yesterday.slice(0, 7), now, timezone);
  const range = selection?.mode === "custom" ? { startIso: selection.customStart!, endIso: selection.customEnd! } : fallback;
  const valid = (iso: string) => /^\d{4}-\d{2}-\d{2}$/.test(iso) && Number.isFinite(Date.parse(iso)) && new Date(iso).toISOString().slice(0, 10) === iso;
  if (!valid(range.startIso) || !valid(range.endIso) || range.startIso > range.endIso || range.endIso > yesterday) throw new Error("Choose a completed day or month ending no later than yesterday.");
  if (type === "DAILY" && range.startIso !== range.endIso) throw new Error("A daily report must cover exactly one day.");
  if (type === "MONTHLY" && (range.startIso.slice(0, 7) !== range.endIso.slice(0, 7) || !range.startIso.endsWith("-01") || (range.endIso !== monthPeriod(range.startIso.slice(0, 7), now, timezone).endIso && range.startIso.slice(0, 7) !== currentMonth))) throw new Error("Choose one complete calendar month or the current month through yesterday.");
  return range;
}

/** Last N months ending at a selected calendar month; current partial month is explicit. */
export function historicalPeriods(count: number, endMonth: string | undefined, includeCurrent: boolean, now = new Date(), timezone = "UTC") {
  const yesterday = reportCalendarYesterday(now, timezone);
  const today = getCalendarDateInTimezone(now, timezone);
  const currentMonth = `${today.year}-${String(today.month).padStart(2, "0")}`;
  const previous = new Date(Date.UTC(today.year, today.month - 1, 0)).toISOString().slice(0, 7);
  const lastMonth = endMonth || (includeCurrent ? currentMonth : previous);
  if (!/^\d{4}-\d{2}$/.test(lastMonth) || lastMonth > currentMonth || (!includeCurrent && lastMonth === currentMonth)) throw new Error("Choose a completed ending month, or explicitly include the current partial month.");
  const [year, month] = lastMonth.split("-").map(Number);
  if (month < 1 || month > 12 || count < 1 || count > 12 || !Number.isInteger(count)) throw new Error("Choose up to 12 valid months.");
  return Array.from({ length: count }, (_, i) => {
    const first = new Date(Date.UTC(year, month - count + i, 1));
    const monthIso = first.toISOString().slice(0, 7);
    const range = monthPeriod(monthIso, now, timezone);
    if (range.startIso > yesterday) throw new Error("The current month has no completed days yet.");
    const name = new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" }).format(first);
    const partial = monthIso === currentMonth;
    return { ...range, monthName: name, year: first.getUTCFullYear(), performanceHeader: `YOUR ${name.toUpperCase()} PERFORMANCE REPORT${partial ? " (MTD)" : ""}`, fullMonthLabel: `${name} ${first.getUTCFullYear()}${partial ? " (MTD)" : ""}` };
  });
}

/** Default Monthly to the complete months actually represented by an uploaded file. */
export function monthlySelectionFromBounds(bounds: { minIso: string; maxIso: string } | null | undefined, now = new Date(), timezone = "UTC") {
  const yesterday = reportCalendarYesterday(now, timezone);
  const today = getCalendarDateInTimezone(now, timezone);
  const currentMonth = `${today.year}-${String(today.month).padStart(2, "0")}`;
  const endMonth = bounds && bounds.maxIso.slice(0, 7) < yesterday.slice(0, 7) ? bounds.maxIso.slice(0, 7) : yesterday.slice(0, 7);
  const range = monthPeriod(endMonth, now, timezone);
  if (bounds && endMonth === currentMonth && bounds.maxIso < range.endIso) range.endIso = bounds.maxIso;
  let count = 1;
  if (bounds) {
    const first = new Date(bounds.minIso.slice(0, 7) + "-01T12:00:00Z");
    if (!bounds.minIso.endsWith("-01")) first.setUTCMonth(first.getUTCMonth() + 1);
    const last = new Date(endMonth + "-01T12:00:00Z");
    count = Math.max(1, Math.min(12, (last.getUTCFullYear() - first.getUTCFullYear()) * 12 + last.getUTCMonth() - first.getUTCMonth() + 1));
  }
  const start = new Date(endMonth + "-01T12:00:00Z"); start.setUTCMonth(start.getUTCMonth() - count + 1);
  return { count, startIso: start.toISOString().slice(0, 10), endIso: range.endIso };
}

/** Restore older monthly drafts that predate the explicit month-count field. */
export function restoredMonthCount(count: number | undefined, type: string | undefined, start?: string, end?: string): number {
  if (Number.isInteger(count) && count! >= 1 && count! <= 12) return count!;
  if (type === "HISTORICAL" && start && end) {
    const a = new Date(start + "T12:00:00Z"), b = new Date(end + "T12:00:00Z");
    const inferred = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + b.getUTCMonth() - a.getUTCMonth() + 1;
    if (Number.isInteger(inferred) && inferred >= 2 && inferred <= 12) return inferred;
  }
  return type === "MONTHLY" ? 1 : 3;
}
