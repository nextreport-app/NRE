import { describe, expect, it } from "vitest";
import {
  displayResultIndicatorLabel,
  syntheticResultTypeFromMetaResultIndicator,
} from "../meta-result-indicator";

describe("meta-result-indicator", () => {
  it("maps BumperTech custom conversion id to Quote Request Submitted", () => {
    const indicator = "actions:offsite_conversion.custom.871123778777517";
    expect(syntheticResultTypeFromMetaResultIndicator(indicator)).toBe("Quote Request Submitted");
    expect(displayResultIndicatorLabel(indicator)).toBe("Quote Request Submitted");
  });

  it("defaults unknown custom conversion ids to website submission", () => {
    const indicator = "actions:offsite_conversion.custom.446052571654985";
    expect(syntheticResultTypeFromMetaResultIndicator(indicator)).toBe("website submission");
    expect(displayResultIndicatorLabel(indicator)).toBe("website submission (custom conversion)");
  });
});
