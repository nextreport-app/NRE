import { describe, expect, it } from "vitest";
import {
  reportBrandingWizardSummary,
  wizardCoverBrandingDisplay,
  wizardShareLinkBrandingDisplay,
} from "../report-branding-wizard-ui";

describe("reportBrandingWizardSummary", () => {
  it("combines cover and link labels", () => {
    expect(
      reportBrandingWizardSummary({
        reportBrandingMode: "nextreport",
        agencyName: "Mohit Sharma",
      }),
    ).toContain("Prepared by Mohit Sharma");
    expect(
      reportBrandingWizardSummary({
        reportBrandingMode: "hidden",
        agencyName: "",
      }),
    ).toContain("Share link: Hide — don't show any name");
  });
});

describe("wizard read-only branding display", () => {
  it("describes cover with and without agency name", () => {
    expect(wizardCoverBrandingDisplay("DashClicks")).toContain("Prepared by DashClicks");
    expect(wizardCoverBrandingDisplay("  ")).toContain("No");
  });

  it("describes share link modes", () => {
    expect(wizardShareLinkBrandingDisplay("nextreport")).toContain("default");
    expect(wizardShareLinkBrandingDisplay("agency")).toContain("Show my or agency name");
  });
});
