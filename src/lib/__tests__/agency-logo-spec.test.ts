import { describe, expect, it } from "vitest";
import {
  AGENCY_LOGO_DISPLAY_MAX_PX,
  AGENCY_LOGO_RECOMMENDED_PX,
  agencyLogoUploadGuidance,
} from "../agency-logo-spec";

describe("agency logo spec", () => {
  it("recommends 2× the display cap", () => {
    expect(AGENCY_LOGO_RECOMMENDED_PX.width).toBe(AGENCY_LOGO_DISPLAY_MAX_PX.width * 2);
    expect(AGENCY_LOGO_RECOMMENDED_PX.height).toBe(AGENCY_LOGO_DISPLAY_MAX_PX.height * 2);
  });

  it("includes dimensions in guidance copy", () => {
    const text = agencyLogoUploadGuidance();
    expect(text).toContain("320 × 72");
    expect(text).toContain("160 × 36");
  });
});
