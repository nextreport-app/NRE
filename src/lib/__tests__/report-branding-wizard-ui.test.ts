import { describe, expect, it } from "vitest";
import {
  reportBrandingWizardSummary,
  wizardUnifiedBrandingDisplay,
} from "../report-branding-wizard-ui";

describe("reportBrandingWizardSummary", () => {
  it("matches unified display", () => {
    expect(
      reportBrandingWizardSummary({
        reportBrandingMode: "agency",
        agencyName: "DashClicks",
      }),
    ).toBe(wizardUnifiedBrandingDisplay("agency", "DashClicks"));
  });
});

describe("wizardUnifiedBrandingDisplay", () => {
  it("describes NextReport default on all surfaces", () => {
    expect(wizardUnifiedBrandingDisplay("nextreport", "")).toContain("Prepared by NextReport");
    expect(wizardUnifiedBrandingDisplay("nextreport", "")).toContain("live share link");
  });

  it("describes agency white-label", () => {
    expect(wizardUnifiedBrandingDisplay("agency", "DashClicks")).toContain("Prepared by DashClicks");
  });

  it("describes hidden branding", () => {
    expect(wizardUnifiedBrandingDisplay("hidden", "DashClicks")).toContain("no credit line");
  });
});
