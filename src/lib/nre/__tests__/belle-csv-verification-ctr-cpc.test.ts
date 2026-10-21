import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { reconcileStandardReportWithCsv } from "../csv-report-reconciliation";
import { buildReportData } from "../report-data";
import { parseCsvText } from "../parse-csv";

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "dc-weekly-the-belle-oct2026.csv");

describe("The Belle weekly CSV — verification includes CTR/CPC and dated scopes", () => {
  it("passes with CTR (all) and CPC (all) checks per window", () => {
    const { rows } = parseCsvText(readFileSync(FIXTURE, "utf8"));
    const now = new Date("2026-10-20T12:00:00Z");
    const report = buildReportData({
      accountName: "The Belle",
      currencySymbol: "$",
      timezone: "America/Los_Angeles",
      monthlyBudget: null,
      mtdDailyRows: rows,
      now,
      reportType: "WEEKLY",
    });
    const verification = reconcileStandardReportWithCsv({
      report,
      mtdDailyRows: rows,
      selectedCampaigns: ["DC - LEADS - INSTANT FORMS - Q3 - JULY2026"],
      reportType: "WEEKLY",
      timezone: "America/Los_Angeles",
      currencySymbol: "$",
      now,
    });

    expect(verification.status).toBe("ok");
    expect(verification.scopesVerified?.some((s) => s.includes("Month-to-date"))).toBe(true);
    expect(verification.scopesVerified?.some((s) => s.includes("Report week"))).toBe(true);
    expect(verification.scopesVerified?.some((s) => s.includes("Last 30 days"))).toBe(true);
    expect(verification.checks.some((c) => c.metric.startsWith("CTR (all)"))).toBe(true);
    expect(verification.checks.some((c) => c.metric.startsWith("CPC (all)"))).toBe(true);
  });

  it("matches Ads Manager Results totals (not orphan Meta leads on blank days)", () => {
    const { rows } = parseCsvText(readFileSync(FIXTURE, "utf8"));
    const now = new Date("2026-10-20T12:00:00Z");
    const report = buildReportData({
      accountName: "The Belle",
      currencySymbol: "$",
      timezone: "America/Los_Angeles",
      monthlyBudget: null,
      mtdDailyRows: rows,
      now,
      reportType: "WEEKLY",
      selectedCampaigns: ["DC - LEADS - INSTANT FORMS - Q3 - JULY2026"],
      weeklyRange: { startIso: "2026-10-13", endIso: "2026-10-19" },
    });

    expect(report.campaignSlides[0]?.metrics.results).toBe("10");
    expect(report.mtdRow.resultColumns.find((c) => c.label === "META FORM LEADS")?.value).toBe("27");
    expect(report.chart?.campaigns[0]?.results).toBe(45);
  });
});
