/** Client-facing copy clarifying that “Weekly Performance Report” is a bundle, not 7-day-only data. */

export const WEEKLY_REPORT_SCOPE_LINE =
  "Includes last week, MTD, and a last-30-day chart.";

export function reportingWeekLabel(dateRange: string): string {
  const trimmed = dateRange.trim();
  if (!trimmed) return "Reporting week";
  return `Reporting week: ${trimmed}`;
}

export function isWeeklyShareReportType(reportType: string): boolean {
  return reportType === "WEEKLY";
}
