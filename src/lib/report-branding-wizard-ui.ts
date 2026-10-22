import type { ReportBrandingMode } from "@/lib/report-branding";
import { REPORT_BRANDING_SURFACES, reportCreditName } from "@/lib/report-branding";

export type WizardUnifiedBrandingLines = {
  line1: string;
  line2: string;
};

export function wizardUnifiedBrandingLines(
  reportBrandingMode: ReportBrandingMode,
  agencyName: string,
): WizardUnifiedBrandingLines {
  if (reportBrandingMode === "hidden") {
    return {
      line1: "No “Prepared by” line on the cover.",
      line2: `No NextReport or agency name on ${REPORT_BRANDING_SURFACES}.`,
    };
  }

  const credit = reportCreditName({ reportBrandingMode, agencyName });

  if (reportBrandingMode === "agency" && !credit) {
    return {
      line1: "Add your agency name in Account settings.",
      line2: `Then matching branding applies on ${REPORT_BRANDING_SURFACES}.`,
    };
  }

  return {
    line1: `“Prepared by ${credit}” on the cover.`,
    line2: `Matching branding on ${REPORT_BRANDING_SURFACES}.`,
  };
}

export function reportBrandingWizardSummary(input: {
  reportBrandingMode: ReportBrandingMode;
  agencyName: string;
}): string {
  const { line1, line2 } = wizardUnifiedBrandingLines(input.reportBrandingMode, input.agencyName);
  return `${line1} ${line2}`;
}

/** @deprecated Use wizardUnifiedBrandingLines for UI */
export function wizardUnifiedBrandingDisplay(
  reportBrandingMode: ReportBrandingMode,
  agencyName: string,
): string {
  const { line1, line2 } = wizardUnifiedBrandingLines(reportBrandingMode, agencyName);
  return `${line1} ${line2}`;
}
