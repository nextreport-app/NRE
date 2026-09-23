import { describe, expect, it } from "vitest";
import {
  buildReportBrandingSettings,
  emailFooterPrimary,
  emailGeneratedByLine,
  reportBrandingFromShareJson,
  resolveShareBrandingDisplay,
  sharePageTitleSuffix,
} from "../report-branding";

describe("report branding", () => {
  it("defaults to NextReport branding", () => {
    const display = resolveShareBrandingDisplay(buildReportBrandingSettings({}));
    expect(display.showNextReportLogo).toBe(true);
    expect(display.showPoweredBy).toBe(true);
    expect(display.footerPrimary).toContain("NextReport");
  });

  it("uses agency name when agency mode is selected", () => {
    const display = resolveShareBrandingDisplay(
      buildReportBrandingSettings({ reportBrandingMode: "agency", agencyName: "Bright Path" }),
    );
    expect(display.showNextReportLogo).toBe(false);
    expect(display.headerTitle).toBe("Bright Path");
    expect(display.footerPrimary).toBe("Report prepared by Bright Path");
  });

  it("falls back to hidden when agency mode has no name", () => {
    const display = resolveShareBrandingDisplay(
      buildReportBrandingSettings({ reportBrandingMode: "agency", agencyName: "" }),
    );
    expect(display.footerPrimary).toBeNull();
    expect(display.showNextReportLogo).toBe(false);
  });

  it("reads snapshotted branding from share JSON", () => {
    const branding = reportBrandingFromShareJson({
      reportBranding: { mode: "hidden", agencyName: null },
    });
    expect(branding.mode).toBe("hidden");
  });

  it("removes NextReport from client email when hidden", () => {
    expect(emailGeneratedByLine({ mode: "hidden", agencyName: null }, "Alex")).toBe("Alex");
    expect(emailFooterPrimary({ mode: "hidden", agencyName: null }, "Alex")).toBeNull();
  });

  it("uses agency or neutral suffix for share page titles", () => {
    expect(sharePageTitleSuffix({ mode: "nextreport", agencyName: null })).toBe("NextReport");
    expect(sharePageTitleSuffix({ mode: "agency", agencyName: "Bright Path" })).toBe("Bright Path");
    expect(sharePageTitleSuffix({ mode: "hidden", agencyName: null })).toBe("Report");
  });
});
