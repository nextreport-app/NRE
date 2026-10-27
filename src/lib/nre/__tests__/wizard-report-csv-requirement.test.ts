import { describe, expect, it } from "vitest";
import { wizardCsvRequirementForReportType } from "../wizard-report-csv-requirement";

describe("wizardCsvRequirementForReportType", () => {
  it("weekly uses last 30 days day-wise", () => {
    const req = wizardCsvRequirementForReportType({
      reportType: "WEEKLY",
      clientTimezone: "UTC",
    });
    expect(req.shortNote).toMatch(/Last 30 days/i);
    expect(req.dayWiseRequired).toBe(true);
  });

  it("historical is multi-month not last 30 only", () => {
    const req = wizardCsvRequirementForReportType({
      reportType: "HISTORICAL",
      clientTimezone: "UTC",
    });
    expect(req.shortNote).toMatch(/Multi-month/i);
    expect(req.detail).toMatch(/not a single Last 30/i);
  });

  it("daily allows shorter export", () => {
    const req = wizardCsvRequirementForReportType({
      reportType: "DAILY",
      clientTimezone: "UTC",
    });
    expect(req.shortNote).toMatch(/Selected day/i);
  });
});
