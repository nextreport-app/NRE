import { describe, expect, it } from "vitest";
import { agencyNameForCoverSlide } from "../user-report-branding";

describe("agencyNameForCoverSlide", () => {
  it("uses NextReport on cover when mode is nextreport", () => {
    expect(agencyNameForCoverSlide({ reportBrandingMode: "nextreport", agencyName: null })).toBe(
      "NextReport",
    );
  });

  it("uses agency name only in agency mode", () => {
    expect(
      agencyNameForCoverSlide({ reportBrandingMode: "agency", agencyName: "DashClicks" }),
    ).toBe("DashClicks");
  });

  it("omits cover credit in hidden mode even if name is saved", () => {
    expect(
      agencyNameForCoverSlide({ reportBrandingMode: "hidden", agencyName: "DashClicks" }),
    ).toBeNull();
  });
});
