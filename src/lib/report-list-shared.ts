import { formatClientTimestamp, formatClientCalendarRange, storedReportDateToIso } from "./client-date-format";
import { formatReportWeekRange } from "@/lib/nre/report-display-name";

/** The public read-only share page's URL — see app/r/[token]/page.tsx. Shared by report-history-list.tsx (recent 10) and full-report-history-list.tsx (all reports). */
export function shareReportUrl(shareToken: string): string {
  return `nextreport.in/r/${shareToken}`;
}

/** @deprecated Prefer formatReportGeneratedAt for history rows. */
export function formatReportDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

const GENERATED_AT_FORMAT: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
};

/** When the report finished generating — shown prominently in history lists. */
export function formatReportGeneratedAt(iso: string, timeZone?: string, currency?: string): string {
  if (currency) return formatClientTimestamp(iso, currency, timeZone);
  return new Intl.DateTimeFormat("en-US", {
    ...GENERATED_AT_FORMAT,
    timeZone: timeZone ?? "UTC",
  }).format(new Date(iso));
}

/** Last day the report (and share link) remain before auto-purge. */
export function formatReportAutoRemoveDate(
  createdAtIso: string,
  retentionDays: number,
  timeZone?: string,
  currency?: string,
): string {
  const created = new Date(createdAtIso);
  const remove = new Date(created);
  remove.setUTCDate(remove.getUTCDate() + retentionDays);
  if (currency) return formatClientTimestamp(remove, currency, timeZone, false);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: timeZone ?? "UTC",
  }).format(remove);
}

const REPORT_TYPE_LABELS: Record<string, string> = {
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  DAILY: "Daily",
  COMPARISON: "Comparison",
  CREATIVE: "Creative",
};

export function reportHistoryPeriodLabel(reportType: string, weekStart: string | null, weekEnd: string | null, currency?: string): string {
  if (weekStart && weekEnd) {
    const start = storedReportDateToIso(weekStart), end = storedReportDateToIso(weekEnd);
    if (currency && start && end) return formatClientCalendarRange(start, end, currency);
    return formatReportWeekRange(weekStart, weekEnd);
  }
  return REPORT_TYPE_LABELS[reportType] ?? reportType;
}

export function reportHistoryMetaSubtitle(
  item: { createdAt: string; reportType: string; weekStart: string | null; weekEnd: string | null },
  opts: { timeZone?: string; retentionDays: number; currency?: string },
): { generatedLine: string; detailLine: string } {
  const period = reportHistoryPeriodLabel(item.reportType, item.weekStart, item.weekEnd, opts.currency);
  const removeDate = formatReportAutoRemoveDate(item.createdAt, opts.retentionDays, opts.timeZone, opts.currency);
  return {
    generatedLine: `Generated ${formatReportGeneratedAt(item.createdAt, opts.timeZone, opts.currency)}`,
    detailLine: `Report period: ${period} · Auto-removes ${removeDate}`,
  };
}
