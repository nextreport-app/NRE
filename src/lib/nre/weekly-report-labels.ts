import { reportCalendarYesterday } from "./report-period-selection";
import { storedReportDateToIso } from "@/lib/client-date-format";
/** Client-facing copy clarifying that “Weekly Performance Report” is a bundle, not 7-day-only data. */

export const WEEKLY_REPORT_SCOPE_LINE =
  "Includes the last 7 days, MTD, and a last-30-day chart.";

export function reportingWeekLabel(dateRange: string): string {
  const trimmed = dateRange.trim();
  if (!trimmed) return "Reporting period";
  return `Reporting period: ${trimmed}`;
}

export function isWeeklyShareReportType(reportType: string): boolean {
  return reportType === "WEEKLY";
}

/** Saved periods may be custom-length: only call an actual seven-day range "last 7 days". */
export function weeklyReportScopeLine(storedRange: string, generatedAt?: string, timezone = "UTC"): string {
  const [rawStart, rawEnd] = storedRange.split(" to ");
  const start = storedReportDateToIso(rawStart ?? ""), end = storedReportDateToIso(rawEnd ?? "");
  const generated = generatedAt ? new Date(generatedAt) : null;
  const endsYesterday = generated && Number.isFinite(generated.getTime()) && end === reportCalendarYesterday(generated, timezone);
  return start && end && endsYesterday && Date.parse(end) - Date.parse(start) === 6 * 86400000
    ? WEEKLY_REPORT_SCOPE_LINE
    : "Includes the reporting period, MTD, and a last-30-day chart.";
}
