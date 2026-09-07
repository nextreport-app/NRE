import { describe, expect, it } from "vitest";
import { readGa4RowsWithAutoMap } from "@/lib/nre/ga4-columns";
import { buildWebsiteReportFromCsv } from "@/lib/nre/build-website-report-from-csv";
import { validateGa4Csv } from "@/lib/nre/validate-ga4";
import { DEFAULT_WEBSITE_REPORT_CONFIG } from "@/lib/nre/website-report-config";

describe("ga4-csv", () => {
  it("parses channel aggregate CSV and builds report", () => {
    const headers = ["Session default channel group", "Sessions", "Engagement rate", "Conversions"];
    const dataRows = [
      ["Organic Search", "1200", "68.5%", "24"],
      ["Direct", "400", "55.0%", "8"],
      ["Paid Search", "300", "72.1%", "15"],
    ];
    const { colMap, rows } = readGa4RowsWithAutoMap(headers, dataRows);
    const validation = validateGa4Csv(colMap, rows, new Date(), headers);
    expect(validation.valid).toBe(true);

    const report = buildWebsiteReportFromCsv({
      rows,
      colMap,
      config: DEFAULT_WEBSITE_REPORT_CONFIG,
      currentRange: { startIso: "2026-09-01", endIso: "2026-09-06" },
      currencySymbol: "$",
    });

    expect(report.overviewMetrics[0]?.value).toBe("1,900");
    expect(report.channels).toHaveLength(3);
    expect(report.channels[0]?.channel).toBe("Organic Search");
  });

  it("parses daily CSV with date filter", () => {
    const headers = ["Date", "Sessions", "Total users", "Conversions"];
    const dataRows = [
      ["2026-09-01", "100", "80", "2"],
      ["2026-09-02", "120", "90", "3"],
      ["2026-08-30", "50", "40", "1"],
    ];
    const { colMap, rows } = readGa4RowsWithAutoMap(headers, dataRows);
    const report = buildWebsiteReportFromCsv({
      rows,
      colMap,
      config: {
        ...DEFAULT_WEBSITE_REPORT_CONFIG,
        datePreset: "custom",
        startIso: "2026-09-01",
        endIso: "2026-09-06",
      },
      currentRange: { startIso: "2026-09-01", endIso: "2026-09-06" },
      currencySymbol: "$",
    });
    expect(report.overviewMetrics[0]?.value).toBe("220");
  });
});
