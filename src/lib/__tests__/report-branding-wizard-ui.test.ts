import { describe, expect, it } from "vitest";
import {
  reportBrandingWizardSummary,
  shouldExpandReportBrandingWizard,
} from "../report-branding-wizard-ui";

describe("shouldExpandReportBrandingWizard", () => {
  it("expands for first-time NextReport defaults", () => {
    expect(
      shouldExpandReportBrandingWizard({
        initialReportBrandingMode: "nextreport",
        initialAgencyName: null,
        initialShowAgencyNameOnCover: true,
      }),
    ).toBe(true);
  });

  it("starts collapsed when agency white-label was already configured", () => {
    expect(
      shouldExpandReportBrandingWizard({
        initialReportBrandingMode: "agency",
        initialAgencyName: "Acme Ads",
        initialShowAgencyNameOnCover: true,
      }),
    ).toBe(false);
  });
});

describe("reportBrandingWizardSummary", () => {
  it("combines cover and link labels", () => {
    expect(
      reportBrandingWizardSummary({
        reportBrandingMode: "nextreport",
        agencyName: "Mohit Sharma",
        showAgencyNameOnCover: true,
      }),
    ).toContain("Prepared by Mohit Sharma");
    expect(
      reportBrandingWizardSummary({
        reportBrandingMode: "hidden",
        agencyName: "",
        showAgencyNameOnCover: true,
      }),
    ).toContain("Share link: Hide third-party branding");
  });
});
