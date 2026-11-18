import { describe, expect, it } from "vitest";
import {
  defaultDeckTitleForReportType,
  WIZARD_REPORT_TYPE_COPY,
  wizardReportTypePickerLabel,
} from "../wizard-report-type-copy";

describe("wizard report type copy", () => {
  it("uses distinct titles for Yesterday vs Day-by-Day table", () => {
    expect(wizardReportTypePickerLabel("DAILY")).toBe("Daily report");
    expect(wizardReportTypePickerLabel("DAY_BREAKDOWN")).toBe("Daily report");
    expect(defaultDeckTitleForReportType("DAILY")).not.toBe(defaultDeckTitleForReportType("DAY_BREAKDOWN"));
  });

  it("each launch type has non-empty you-get line", () => {
    for (const copy of Object.values(WIZARD_REPORT_TYPE_COPY)) {
      expect(copy.cardYouGet.length).toBeGreaterThan(20);
      expect(copy.cardOneLiner.length).toBeGreaterThan(3);
      expect(copy.pickerLabel).toBe(copy.cardHeading);
    }
  });

  it("uses the Compare action and explains the default seven-day comparison", () => {
    expect(WIZARD_REPORT_TYPE_COPY.COMPARISON.pickerLabel).toBe("Compare");
    expect(WIZARD_REPORT_TYPE_COPY.COMPARISON.cardOneLiner).toBe("Compare your performance in the last 7 days to the previous 7 days or choose two custom date ranges.");
  });

  it("weekly one-liner mentions MTD and chart bundle", () => {
    expect(WIZARD_REPORT_TYPE_COPY.WEEKLY.cardOneLiner).toContain("MTD");
    expect(WIZARD_REPORT_TYPE_COPY.WEEKLY.cardOneLiner).toContain("30");
  });
});
