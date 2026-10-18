import { describe, expect, it } from "vitest";
import { reportBrandingWizardSummary } from "../report-branding-wizard-ui";

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
    ).toContain("Share link: Hide — don't show any name");
  });
});
