import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CPR_PARITY_GOLDEN_CASES } from "../cpr-parity-golden";
import {
  assertCampaignSlideCprParity,
  assertChartCampaignCprParity,
  assertMtdResultColumnCprParity,
} from "../cpr-parity";
import { parseCsvText } from "../parse-csv";
import { buildReportData } from "../report-data";
import { reconcileStandardReportWithCsv } from "../csv-report-reconciliation";

const FIXTURES = resolve(__dirname, "fixtures");

describe("CPR parity golden gate — spend ÷ results on every surface", () => {
  for (const golden of CPR_PARITY_GOLDEN_CASES) {
    it(golden.id, () => {
      const rows = parseCsvText(readFileSync(resolve(FIXTURES, golden.fixture), "utf8")).rows;
      const report = buildReportData({
        ...golden.build,
        mtdDailyRows: rows,
        campaignObjectives: golden.campaignObjectives,
      });

      for (const slide of report.campaignSlides) {
        if (golden.campaignFilter && slide.campaignName !== golden.campaignFilter) continue;
        assertCampaignSlideCprParity(slide);
      }

      if (golden.mtdResultLabel) {
        assertMtdResultColumnCprParity(report.mtdRow, golden.mtdResultLabel);
      }

      assertChartCampaignCprParity(report, golden.campaignFilter);

      if (golden.build.reportType === "WEEKLY" && golden.build.weeklyRange) {
        const verification = reconcileStandardReportWithCsv({
          report,
          mtdDailyRows: rows,
          selectedCampaigns: golden.build.selectedCampaigns,
          weeklyRange: golden.build.weeklyRange,
          reportType: "WEEKLY",
          timezone: golden.build.timezone,
          currencySymbol: golden.build.currencySymbol,
          now: golden.build.now,
          campaignObjectives: golden.campaignObjectives,
        });
        expect(verification.status).toBe("ok");
        const cprChecks = verification.checks.filter(
          (c) => c.metric.toUpperCase().includes("COST PER") && c.status === "mismatch",
        );
        expect(cprChecks).toEqual([]);
      }
    });
  }
});
