import { describe, expect, it } from "vitest";
import {
  defaultDeckTitleForReportType,
  WIZARD_REPORT_TYPE_COPY,
  wizardReportTypePickerLabel,
} from "../wizard-report-type-copy";

describe("wizard report type copy", () => {
  it("uses distinct titles for Yesterday vs Day-by-Day table", () => {
    expect(wizardReportTypePickerLabel("DAILY")).toBe("Yesterday Performance Report");
    expect(wizardReportTypePickerLabel("DAY_BREAKDOWN")).toBe("Day-by-Day Table Report");
    expect(defaultDeckTitleForReportType("DAILY")).not.toBe(defaultDeckTitleForReportType("DAY_BREAKDOWN"));
  });

  it("each launch type has non-empty you-get line", () => {
    for (const copy of Object.values(WIZARD_REPORT_TYPE_COPY)) {
      expect(copy.cardYouGet.length).toBeGreaterThan(20);
      expect(copy.pickerLabel).toBe(copy.cardHeading);
    }
  });
});
