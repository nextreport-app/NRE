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

/** Save a wizard File to the user's Downloads folder (browser only). */
export function downloadWizardCsvFile(file: File): void {
  if (typeof window === "undefined") return;
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name.endsWith(".csv") ? file.name : `${file.name}.csv`;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function wizardPlatformImportDescription(platform: "META" | "GOOGLE" | "TIKTOK"): string {
  switch (platform) {
    case "META":
      return "Upload a CSV export from Meta Ads Manager";
    case "GOOGLE":
      return "Upload a CSV export from Google Ads";
    case "TIKTOK":
      return "Upload a CSV export from TikTok Ads Manager";
  }
}
