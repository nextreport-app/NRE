import { describe, expect, it } from "vitest";
import {
  buildShareComparisonReportData,
  isShareComparisonReportData,
} from "../nre/share-comparison-report";

const baseComparison = {
  isPaused: false,
  accountName: "Acme Co",
  reportDate: "Sep 1, 2026",
  periodALabel: "Aug 1 - Aug 15, 2026",
  periodBLabel: "Aug 16 - Aug 31, 2026",
  campaigns: [],
  totals: {
    metricsA: {
      spend: { value: 0, formatted: "$0" },
      reach: { value: 0, formatted: "0" },
      results: { value: 0, formatted: "0" },
      cpr: { value: 0, formatted: "$0" },
    },
    metricsB: {
      spend: { value: 0, formatted: "$0" },
      reach: { value: 0, formatted: "0" },
      results: { value: 0, formatted: "0" },
      cpr: { value: 0, formatted: "$0" },
    },
    changes: {
      spend: { percent: 0, direction: "flat" as const },
      reach: { percent: 0, direction: "flat" as const },
      results: { percent: 0, direction: "flat" as const },
      cpr: { percent: 0, direction: "flat" as const },
    },
  },
};

describe("share comparison report", () => {
  it("builds versioned comparison share payload", () => {
    const data = buildShareComparisonReportData(baseComparison, "META", {
      agencyName: "Bright Path",
      reportBranding: { mode: "agency", agencyName: "Bright Path", agencyLogoUrl: null },
    });
    expect(data.version).toBe(1);
    expect(data.kind).toBe("comparison");
    expect(data.platform).toBe("META");
    expect(isShareComparisonReportData(data)).toBe(true);
  });

  it("rejects standard share payloads", () => {
    expect(isShareComparisonReportData({ version: 1, campaigns: [] })).toBe(false);
  });
});
