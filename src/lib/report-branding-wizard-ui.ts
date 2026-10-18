import type { ReportBrandingMode } from "@/lib/report-branding";
import { REPORT_BRANDING_MODE_LABELS } from "@/lib/report-branding";

const COLLAPSED_STORAGE_KEY = "nre.reportBrandingWizardCollapsed";

export function markReportBrandingWizardCollapsed(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(COLLAPSED_STORAGE_KEY, "1");
  } catch {
    /* private mode */
  }
}

export function reportBrandingWizardSummary(input: {
  reportBrandingMode: ReportBrandingMode;
  agencyName: string;
  showAgencyNameOnCover?: boolean;
}): string {
  const name = input.agencyName.trim();
  const coverPart = !name ? "PPT cover: no agency name" : `PPT cover: Prepared by ${name}`;

  const linkPart =
    input.reportBrandingMode === "nextreport"
      ? "NextReport branding (default)"
      : REPORT_BRANDING_MODE_LABELS[input.reportBrandingMode].title;
  return `${coverPart} · Share link: ${linkPart}`;
}
