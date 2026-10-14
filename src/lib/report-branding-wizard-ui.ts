import type { ReportBrandingMode } from "@/lib/report-branding";
import { REPORT_BRANDING_MODE_LABELS } from "@/lib/report-branding";

const COLLAPSED_STORAGE_KEY = "nre.reportBrandingWizardCollapsed";

export function readReportBrandingWizardCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(COLLAPSED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markReportBrandingWizardCollapsed(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(COLLAPSED_STORAGE_KEY, "1");
  } catch {
    /* private mode */
  }
}

/** Expand on Generate only for first-time defaults; collapse after save or prior customization. */
export function shouldExpandReportBrandingWizard(input: {
  initialReportBrandingMode: ReportBrandingMode;
  initialAgencyName: string | null;
  initialShowAgencyNameOnCover: boolean;
}): boolean {
  if (readReportBrandingWizardCollapsed()) return false;
  const hasAgency = Boolean(input.initialAgencyName?.trim());
  const customizedLink = input.initialReportBrandingMode !== "nextreport";
  const hideCoverName = !input.initialShowAgencyNameOnCover && hasAgency;
  return !customizedLink && !hasAgency && !hideCoverName;
}

export function reportBrandingWizardSummary(input: {
  reportBrandingMode: ReportBrandingMode;
  agencyName: string;
  showAgencyNameOnCover: boolean;
}): string {
  const name = input.agencyName.trim();
  const coverPart = !name
    ? "PPT cover: no agency name"
    : input.showAgencyNameOnCover
      ? `PPT cover: Prepared by ${name}`
      : "PPT cover: name hidden";

  const linkPart = REPORT_BRANDING_MODE_LABELS[input.reportBrandingMode].title;
  return `${coverPart} · Share link: ${linkPart}`;
}
