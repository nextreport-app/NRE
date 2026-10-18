import type { ReportBrandingMode } from "@/lib/report-branding";
import { REPORT_BRANDING_MODE_LABELS } from "@/lib/report-branding";

export function reportBrandingWizardSummary(input: {
  reportBrandingMode: ReportBrandingMode;
  agencyName: string;
}): string {
  const name = input.agencyName.trim();
  const coverPart = !name ? "PPT cover: no agency name" : `PPT cover: Prepared by ${name}`;

  const linkPart =
    input.reportBrandingMode === "nextreport"
      ? "NextReport branding (default)"
      : REPORT_BRANDING_MODE_LABELS[input.reportBrandingMode].title;
  return `${coverPart} · Share link: ${linkPart}`;
}

/** Read-only wizard copy — PowerPoint cover line for this report. */
export function wizardCoverBrandingDisplay(agencyName: string): string {
  const name = agencyName.trim();
  if (!name) {
    return "No “Prepared by …” line on the cover slide.";
  }
  return `“Prepared by ${name}” on the cover slide.`;
}

/** Read-only wizard copy — live share link branding for this report. */
export function wizardShareLinkBrandingDisplay(reportBrandingMode: ReportBrandingMode): string {
  if (reportBrandingMode === "nextreport") {
    return "NextReport branding on the client page (default).";
  }
  if (reportBrandingMode === "agency") {
    return `${REPORT_BRANDING_MODE_LABELS.agency.title} on the client page — your agency name and logo when set.`;
  }
  return `${REPORT_BRANDING_MODE_LABELS.hidden.title} on the client page — report content only.`;
}
