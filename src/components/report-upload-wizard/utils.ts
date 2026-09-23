import type { ValidationIssue } from "@/lib/nre/validate";
import type { DateRangeIso, ReportTypeValue } from "./types";
import {
  DEFAULT_COMPARISON_REPORT_TITLE,
  DEFAULT_CREATIVE_REPORT_TITLE,
  DEFAULT_DAILY_REPORT_TITLE,
  DEFAULT_DAY_BREAKDOWN_REPORT_TITLE,
  DEFAULT_HISTORICAL_REPORT_TITLE,
  DEFAULT_MONTHLY_REPORT_TITLE,
  DEFAULT_QUARTER_REPORT_TITLE,
  DEFAULT_REPORT_TITLE,
  DEFAULT_YTD_REPORT_TITLE,
  SPECIFIC_FIELD_ERRORS,
} from "./constants";

export function defaultReportTitleFor(reportType: ReportTypeValue): string {
  if (reportType === "MONTHLY") return DEFAULT_MONTHLY_REPORT_TITLE;
  if (reportType === "DAILY") return DEFAULT_DAILY_REPORT_TITLE;
  if (reportType === "CREATIVE") return DEFAULT_CREATIVE_REPORT_TITLE;
  if (reportType === "COMPARISON") return DEFAULT_COMPARISON_REPORT_TITLE;
  if (reportType === "HISTORICAL") return DEFAULT_HISTORICAL_REPORT_TITLE;
  if (reportType === "DAY_BREAKDOWN") return DEFAULT_DAY_BREAKDOWN_REPORT_TITLE;
  if (reportType === "QUARTER") return DEFAULT_QUARTER_REPORT_TITLE;
  if (reportType === "YTD") return DEFAULT_YTD_REPORT_TITLE;
  return DEFAULT_REPORT_TITLE;
}

export function buildUploadFormData(
  mtdFile: File | null,
  extra: Record<string, unknown> = {},
  uploadSessionId?: string | null,
): FormData {
  const formData = new FormData();
  if (uploadSessionId) {
    formData.append("uploadSessionId", JSON.stringify(uploadSessionId));
  } else if (mtdFile) {
    formData.append("mtdDailyCsv", mtdFile);
  }
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined) formData.append(key, JSON.stringify(value));
  }
  return formData;
}

export function formatIso(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "UTC" }).format(d);
}

export function formatIsoRange(range: DateRangeIso): string {
  return `${formatIso(range.startIso)} - ${formatIso(range.endIso)}`;
}

export function formatIsoShort(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(d);
}

export function formatSummaryRange(range: DateRangeIso): string {
  const year = new Date(range.endIso + "T00:00:00Z").getUTCFullYear();
  return `${formatIsoShort(range.startIso)} - ${formatIsoShort(range.endIso)}, ${year}`;
}

export function isNoDataRowsError(e: ValidationIssue): boolean {
  return e.field === "rows";
}

export function isSpecificFieldError(e: ValidationIssue): boolean {
  return SPECIFIC_FIELD_ERRORS.has(e.field);
}

export function buildWhatsAppShareUrl(reportUrl: string): string {
  return `https://wa.me/?text=${encodeURIComponent(`Your report is ready: ${reportUrl}`)}`;
}

export function buildTelegramShareUrl(reportUrl: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(reportUrl)}&text=${encodeURIComponent("Your performance report is ready")}`;
}

export function buildSlackShareUrl(reportUrl: string): string {
  return `https://slack.com/share?url=${encodeURIComponent(reportUrl)}&text=${encodeURIComponent("Your performance report is ready")}`;
}

export function buildMailtoShareUrl(reportUrl: string, accountName: string): string {
  const subject = encodeURIComponent(`${accountName} — Performance Report`);
  const body = encodeURIComponent(`Hi,\n\nYour report is ready to view:\n${reportUrl}\n\n`);
  return `mailto:?subject=${subject}&body=${body}`;
}

export function buildShareReportUrl(shareToken: string): string {
  return `nextreport.in/r/${shareToken}`;
}

export function isApiSyncArtifact(file: File | null): boolean {
  return Boolean(file?.name.includes("-api-sync-"));
}

export function wizardPlatformImportDescription(platform: "META" | "GOOGLE" | "TIKTOK"): string {
  switch (platform) {
    case "META":
      return "Connect via API or upload a CSV from Ads Manager";
    case "GOOGLE":
      return "Connect via API or upload a CSV from Google Ads";
    case "TIKTOK":
      return "Connect via API or upload a CSV from TikTok Ads Manager";
  }
}
