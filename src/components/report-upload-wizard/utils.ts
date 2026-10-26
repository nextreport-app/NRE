import type { ValidationIssue } from "@/lib/nre/validate";
import type { DateRangeIso, ReportTypeValue } from "./types";
import { defaultDeckTitleForReportType } from "@/lib/nre/wizard-report-type-copy";
import { SPECIFIC_FIELD_ERRORS } from "./constants";

export function defaultReportTitleFor(reportType: ReportTypeValue): string {
  return defaultDeckTitleForReportType(reportType);
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

export type ClientReportShareMessageInput = {
  clientName: string;
  /** Deck / report title shown to the client (defaults to reportTypeLabel when omitted). */
  reportTitle?: string;
  reportTypeLabel: string;
  platformLabel: string;
  dateRangeLabel: string;
  reportUrl: string;
};

/** Plain-text client share blurb — WhatsApp, Slack, email, Teams, SMS, etc. */
export function buildClientReportShareMessage(input: ClientReportShareMessageInput): string {
  const title = (input.reportTitle?.trim() || input.reportTypeLabel).trim();
  const period = input.dateRangeLabel.trim() || "this period";
  return [
    `Hi ${input.clientName},`,
    "",
    `Your ${title} (${input.platformLabel}) for ${period} is ready to review.`,
    "",
    "View the live report here:",
    input.reportUrl,
    "",
    "Please take a look when you have a moment and share any questions.",
  ].join("\n");
}

/** Pre-filled client share message for agencies (WhatsApp one-tap send). */
export function buildClientReportWhatsAppShareUrl(input: ClientReportShareMessageInput): string {
  const text = buildClientReportShareMessage(input);
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function buildTelegramShareUrl(reportUrl: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(reportUrl)}&text=${encodeURIComponent("Your performance report is ready")}`;
}

export function buildSlackShareUrl(reportUrl: string): string {
  return `https://slack.com/share?url=${encodeURIComponent(reportUrl)}&text=${encodeURIComponent("Your performance report is ready")}`;
}

/** Pre-filled client share message for agencies (Slack share dialog). */
export function buildClientReportSlackShareUrl(input: ClientReportShareMessageInput): string {
  const text = buildClientReportShareMessage(input);
  return `https://slack.com/share?url=${encodeURIComponent(input.reportUrl)}&text=${encodeURIComponent(text)}`;
}

/** Opens Microsoft Teams share dialog (web or desktop) with link + message. */
export function buildClientReportTeamsShareUrl(input: ClientReportShareMessageInput): string {
  const text = buildClientReportShareMessage(input);
  const params = new URLSearchParams({
    href: input.reportUrl,
    msgText: text,
  });
  return `https://teams.microsoft.com/share?${params.toString()}`;
}

export function buildMailtoShareUrl(reportUrl: string, accountName: string): string {
  const subject = encodeURIComponent(`${accountName} — Performance Report`);
  const body = encodeURIComponent(`Hi,\n\nYour report is ready to view:\n${reportUrl}\n\n`);
  return `mailto:?subject=${subject}&body=${body}`;
}

/** Mailto with the same client-ready body as WhatsApp / Copy message. */
export function buildClientReportMailtoShareUrl(input: ClientReportShareMessageInput): string {
  const title = (input.reportTitle?.trim() || input.reportTypeLabel).trim();
  const subject = encodeURIComponent(`${title} — ${input.clientName}`);
  const body = encodeURIComponent(buildClientReportShareMessage(input));
  return `mailto:?subject=${subject}&body=${body}`;
}

export function buildShareReportUrl(shareToken: string): string {
  return `nextreport.in/r/${shareToken}`;
}

/** Keep Preview/local reports on their own deployment; production keeps its own host. */
export function buildShareReportAbsoluteUrl(shareToken: string, origin?: string): string {
  const reportOrigin = origin ?? (typeof window !== "undefined" ? window.location.origin : "https://nextreport.in");
  return new URL(`/r/${encodeURIComponent(shareToken)}`, reportOrigin).href;
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
