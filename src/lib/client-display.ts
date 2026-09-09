import { getPreviousMonthComparisonInfo, type PreviousMonthDataStatus } from "@/lib/nre/previous-month-data-status";
import type { Currency } from "@/generated/prisma/enums";

const FRIENDLY_TIMEZONES: Record<string, string> = {
  "America/New_York": "Eastern Time",
  "America/Chicago": "Central Time",
  "America/Denver": "Mountain Time",
  "America/Los_Angeles": "Pacific Time",
  "America/Toronto": "Toronto",
  "America/Vancouver": "Vancouver",
  "Europe/London": "London",
  "Europe/Paris": "Paris",
  "Europe/Berlin": "Berlin",
  "Asia/Kolkata": "India",
  "Asia/Dubai": "Dubai",
  "Asia/Singapore": "Singapore",
  "Australia/Sydney": "Sydney",
  "Pacific/Auckland": "Auckland",
};

const REPORT_TYPE_LABELS: Record<string, string> = {
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  DAILY: "Daily",
  COMPARISON: "Comparison",
  CREATIVE: "Creative",
  WEBSITE: "Website",
  HISTORICAL: "Multi-Month",
};

/** Human-readable timezone for client list cards — keeps IANA id in title attribute. */
export function formatClientTimezone(iana: string): string {
  if (FRIENDLY_TIMEZONES[iana]) return FRIENDLY_TIMEZONES[iana];
  const segment = iana.split("/").pop();
  return segment ? segment.replace(/_/g, " ") : iana;
}

export function formatClientCurrency(currency: Currency): string {
  return currency;
}

export function formatReportTypeLabel(reportType: string | null | undefined): string | null {
  if (!reportType) return null;
  return REPORT_TYPE_LABELS[reportType] ?? reportType;
}

export function formatAbsoluteReportDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

/** Short relative label for last report — full date goes in a tooltip. */
export function formatRelativeReportDate(iso: string, now = new Date()): string {
  const then = new Date(iso);
  const diffMs = now.getTime() - then.getTime();
  const days = Math.floor(diffMs / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} wk ago`;
  if (days < 365) return `${Math.floor(days / 30)} mo ago`;
  return formatAbsoluteReportDate(iso);
}

export interface PreviousMonthListStatus {
  status: PreviousMonthDataStatus;
  label: string;
  title: string;
}

/** List-card copy for Previous Month Data — uses same stale logic as the wizard. */
export function getPreviousMonthListStatus(
  hasFile: boolean,
  updatedAtIso: string | null,
  timezone: string,
  now = new Date(),
): PreviousMonthListStatus {
  const info = getPreviousMonthComparisonInfo(hasFile, updatedAtIso, timezone, now);
  if (info.status === "missing") {
    return {
      status: "missing",
      label: "Prev month — not uploaded",
      title: `Upload ${info.expectedMonthName} data on Manage for the previous-month overview row.`,
    };
  }
  if (info.status === "stale") {
    const { monthName: currentMonthName } = getCalendarMonthInTimezone(now, timezone);
    return {
      status: "stale",
      label: "Prev month — re-upload this month",
      title: `${info.expectedMonthName} data is saved but was uploaded before ${currentMonthName}. Re-upload the file on Manage so Monthly reports include the comparison row this month.`,
    };
  }
  return {
    status: "current",
    label: "Prev month ready",
    title: `${info.expectedMonthName} comparison data is ready for reports this month.`,
  };
}

function getCalendarMonthInTimezone(now: Date, timezone: string): { monthName: string; year: number } {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, month: "long", year: "numeric" }).formatToParts(
    now,
  );
  const monthName = parts.find((p) => p.type === "month")?.value ?? "this month";
  const year = Number(parts.find((p) => p.type === "year")?.value ?? now.getUTCFullYear());
  return { monthName, year };
}

export function getClientInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : "?";
}
