import { apiQueryCoverage } from "./api-query-coverage";
import { computeCsvDateBounds, type CsvDateBounds, type DateRangeIso } from "./date-range";
import { getRowDate, type NreRow } from "./columns";
import { parseDate } from "./dates";
import { toIsoDate } from "./date-range";
import { reportCalendarYesterday, reportPeriodAnchor } from "./report-period-selection";
import { comparisonPeriodSchema, dateSelectionSchema, parseJsonFormField, reportTypeSchema, type DateSelection } from "../validators/report-wizard";

/** A reporting clock follows the upload, but never treats today/future rows as complete. */
export function csvReportingCalendar(bounds: CsvDateBounds | null | undefined, now = new Date(), timezone = "UTC") {
  const yesterday = reportCalendarYesterday(now, timezone);
  const endIso = bounds?.maxIso && bounds.maxIso < yesterday ? bounds.maxIso : yesterday;
  return { endIso, yesterday, adjusted: endIso < yesterday, now: endIso < yesterday ? reportPeriodAnchor(endIso, timezone) : now };
}
export function completeCsvBounds(rows: NreRow[], now = new Date(), timezone = "UTC") {
  const yesterday = reportCalendarYesterday(now, timezone);
  return computeCsvDateBounds(rows.filter(row => { const day = parseDate(row._reportPeriod?.endIso ?? getRowDate(row)); return day && toIsoDate(day) <= yesterday; }));
}
export function csvReportNow(rows: NreRow[], now = new Date(), timezone = "UTC") {
  return csvReportingCalendar(completeCsvBounds(rows, now, timezone), now, timezone).now;
}
function shift(iso: string, days: number) {
  const value = new Date(`${iso}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
export function alignCsvRange(range: DateRangeIso, bounds: CsvDateBounds | null | undefined, type: string, now = new Date(), timezone = "UTC"): DateRangeIso {
  const clock = csvReportingCalendar(bounds, now, timezone);
  if (!clock.adjusted || range.startIso > range.endIso || range.endIso <= clock.endIso || range.endIso > clock.yesterday || !Number.isFinite(Date.parse(range.startIso)) || !Number.isFinite(Date.parse(range.endIso))) return range;
  if (type === "MONTHLY" || type === "HISTORICAL") {
    if (range.endIso.slice(0, 7) === clock.endIso.slice(0, 7)) return { startIso: range.startIso, endIso: clock.endIso };
    const start = new Date(`${range.startIso.slice(0, 7)}-01T12:00:00Z`);
    const end = new Date(`${range.endIso.slice(0, 7)}-01T12:00:00Z`);
    const count = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth();
    const first = new Date(`${clock.endIso.slice(0, 7)}-01T12:00:00Z`); first.setUTCMonth(first.getUTCMonth() - count);
    return { startIso: first.toISOString().slice(0, 10), endIso: clock.endIso };
  }
  const offset = Math.round((Date.parse(clock.endIso) - Date.parse(range.endIso)) / 86400000);
  return { startIso: shift(range.startIso, offset), endIso: clock.endIso };
}
export function alignCsvComparison(a: DateRangeIso, b: DateRangeIso, bounds: CsvDateBounds | null | undefined, now = new Date(), timezone = "UTC") {
  const latest = a.endIso > b.endIso ? a.endIso : b.endIso;
  const aligned = alignCsvRange({ startIso: latest, endIso: latest }, bounds, "COMPARISON", now, timezone);
  const offset = Math.round((Date.parse(aligned.endIso) - Date.parse(latest)) / 86400000);
  if (!Number.isFinite(offset) || !offset) return { periodA: a, periodB: b };
  return { periodA: { startIso: shift(a.startIso, offset), endIso: shift(a.endIso, offset) }, periodB: { startIso: shift(b.startIso, offset), endIso: shift(b.endIso, offset) } };
}
export function alignCsvSelection(selection: DateSelection | undefined, bounds: CsvDateBounds | null | undefined, type: string, now = new Date(), timezone = "UTC"): DateSelection | undefined {
  if (selection?.mode !== "custom" || !selection.customStart || !selection.customEnd) return selection;
  const range = alignCsvRange({ startIso: selection.customStart, endIso: selection.customEnd }, bounds, type, now, timezone);
  return { ...selection, customStart: range.startIso, customEnd: range.endIso };
}
/** Preview/generation/reconciliation consume the same canonical request dates. */
export function alignCsvReportFormData(form: FormData | null, rows: NreRow[], timezone: string, now = new Date()) {
  if (!form) return;
  // Supplemental previous-month uploads belong to manual CSV reports only.
  // Apply this before preview, verification, cache fingerprinting and generation.
  if (apiQueryCoverage(rows)) form.set("includePreviousMonthComparison", "false");
  const bounds = completeCsvBounds(rows, now, timezone);
  const type = parseJsonFormField(form, "reportType", reportTypeSchema) ?? "WEEKLY";
  const selection = alignCsvSelection(parseJsonFormField(form, "dateSelection", dateSelectionSchema), bounds, type, now, timezone);
  if (selection) form.set("dateSelection", JSON.stringify(selection));
  if (type === "COMPARISON") {
    const a = parseJsonFormField(form, "comparisonPeriodA", comparisonPeriodSchema), b = parseJsonFormField(form, "comparisonPeriodB", comparisonPeriodSchema);
    if (a && b) {
      const aligned = alignCsvComparison(a, b, bounds, now, timezone);
      form.set("comparisonPeriodA", JSON.stringify(aligned.periodA)); form.set("comparisonPeriodB", JSON.stringify(aligned.periodB));
    }
  }
}
