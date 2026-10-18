import type { ReportBrandingMode } from "@/lib/report-branding";
import {
  REPORT_BRANDING_MODE_LABELS,
  REPORT_BRANDING_SURFACES,
  reportCreditName,
} from "@/lib/report-branding";

export function reportBrandingWizardSummary(input: {
  reportBrandingMode: ReportBrandingMode;
  agencyName: string;
}): string {
  return wizardUnifiedBrandingDisplay(input.reportBrandingMode, input.agencyName);
}

/** Read-only wizard / account preview — one choice, all surfaces. */
export function wizardUnifiedBrandingDisplay(
  reportBrandingMode: ReportBrandingMode,
  agencyName: string,
): string {
  const credit = reportCreditName({ reportBrandingMode, agencyName });
  const modeLabel = REPORT_BRANDING_MODE_LABELS[reportBrandingMode].title;

  if (reportBrandingMode === "hidden") {
    return `${modeLabel} — no credit line on the cover; no names on ${REPORT_BRANDING_SURFACES}.`;
  }

  if (credit) {
    return `${modeLabel} — “Prepared by ${credit}” on the cover; matching branding on ${REPORT_BRANDING_SURFACES}.`;
  }

  return `${modeLabel} — add an agency name in Account settings to use this option.`;
}
