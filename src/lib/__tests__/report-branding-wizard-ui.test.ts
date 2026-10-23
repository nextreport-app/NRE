import { describe, expect, it } from "vitest";
import {
  reportBrandingWizardSummary,
  wizardUnifiedBrandingLines,
} from "../report-branding-wizard-ui";

describe("reportBrandingWizardSummary", () => {
  it("includes both branding lines", () => {
    const summary = reportBrandingWizardSummary({
      reportBrandingMode: "agency",
      agencyName: "DashClicks",
    });
    expect(summary).toContain("Prepared by DashClicks");
    expect(summary).toContain("Matching branding on");
  });
});

describe("wizardUnifiedBrandingLines", () => {
  it("uses two lines for agency mode", () => {
    const lines = wizardUnifiedBrandingLines("agency", "DashClicks");
    expect(lines.line1).toBe("“Prepared by DashClicks” on the cover.");
    expect(lines.line2).toMatch(/^Matching branding on /);
  });

  it("uses two lines for NextReport default", () => {
    const lines = wizardUnifiedBrandingLines("nextreport", "");
    expect(lines.line1).toBe("“Prepared by NextReport” on the cover.");
    expect(lines.line2).toContain("live share link");
  });

  it("uses two lines for hidden mode", () => {
    const lines = wizardUnifiedBrandingLines("hidden", "DashClicks");
    expect(lines.line1).toContain("No");
    expect(lines.line2).toContain("No NextReport");
  });
});
