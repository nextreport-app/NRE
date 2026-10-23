import { describe, expect, it } from "vitest";
import {
  buildMetaCustomConversionResultTypeMap,
  syntheticResultTypeFromCustomConversionName,
} from "../meta-custom-conversion-catalog";

describe("meta-custom-conversion-catalog", () => {
  it("maps quote-style custom conversion names to Quote Request Submitted", () => {
    expect(syntheticResultTypeFromCustomConversionName("Quote request submitted")).toBe("Quote Request Submitted");
    expect(syntheticResultTypeFromCustomConversionName("My Quote Request pixel")).toBe("Quote Request Submitted");
  });

  it("builds id → result type map from Graph API rows", () => {
    const map = buildMetaCustomConversionResultTypeMap([
      { id: "871123778777517", name: "Quote Request Submitted" },
      { id: "446052571654985", name: "Website submission" },
    ]);
    expect(map["871123778777517"]).toBe("Quote Request Submitted");
    expect(map["446052571654985"]).toMatch(/website submission/i);
  });

  it("maps CONVERSIONS:SCHEDULE_WEBSITE custom conversion names like Ad Reporting", () => {
    expect(syntheticResultTypeFromCustomConversionName("CONVERSIONS:SCHEDULE_WEBSITE")).toBe(
      "Website appointments scheduled",
    );
  });
});
