import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { adSetKey } from "../ad-sets";
import { reconcileStandardReportWithCsv } from "../csv-report-reconciliation";
import { buildReportData } from "../report-data";
import { parseCsvText } from "../parse-csv";

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "dc-weekly-the-belle-oct2026.csv");

describe("CSV verification — ad-set slides", () => {
  it("checks every ad-set slide in the report week (spend, results, CTR/CPC)", () => {
    const { rows } = parseCsvText(readFileSync(FIXTURE, "utf8"));
    const campaign = "DC - LEADS - INSTANT FORMS - Q3 - JULY2026";
    const adSet = "DC - LEADS - INSTANT FORMS - Q3 - JULY2026";
    const now = new Date("2026-10-20T12:00:00Z");

    const report = buildReportData({
      accountName: "The Belle",
      currencySymbol: "$",
      timezone: "America/Los_Angeles",
      monthlyBudget: null,
      mtdDailyRows: rows,
      now,
      reportType: "WEEKLY",
      selectedCampaigns: [campaign],
      selectedAdSets: [adSetKey(campaign, adSet)],
      weeklyRange: { startIso: "2026-10-13", endIso: "2026-10-19" },
    });

    expect(report.adSetSlides.length).toBeGreaterThan(0);

    const verification = reconcileStandardReportWithCsv({
      report,
      mtdDailyRows: rows,
      selectedCampaigns: [campaign],
      reportType: "WEEKLY",
      timezone: "America/Los_Angeles",
      currencySymbol: "$",
      now,
      weeklyRange: { startIso: "2026-10-13", endIso: "2026-10-19" },
      resultCountingMode: "meta-csv-export",
    });

    expect(verification.status).toBe("ok");
    const adSetScopes = verification.checks.filter((c) => c.scope.includes("Ad set:"));
    expect(adSetScopes.some((c) => c.metric === "Amount spent")).toBe(true);
    expect(adSetScopes.some((c) => c.metric === "META FORM LEADS")).toBe(true);
    expect(adSetScopes.some((c) => c.metric.startsWith("CTR (all)"))).toBe(true);
  });

  it("fails when ad-set slide CPR does not match ad-set spend ÷ results", () => {
    const { rows } = parseCsvText(readFileSync(FIXTURE, "utf8"));
    const campaign = "DC - LEADS - INSTANT FORMS - Q3 - JULY2026";
    const adSet = "DC - LEADS - INSTANT FORMS - Q3 - JULY2026";
    const now = new Date("2026-10-20T12:00:00Z");

    const report = buildReportData({
      accountName: "The Belle",
      currencySymbol: "$",
      timezone: "America/Los_Angeles",
      monthlyBudget: null,
      mtdDailyRows: rows,
      now,
      reportType: "WEEKLY",
      selectedCampaigns: [campaign],
      selectedAdSets: [adSetKey(campaign, adSet)],
      weeklyRange: { startIso: "2026-10-13", endIso: "2026-10-19" },
    });

    report.adSetSlides[0]!.metrics.cpr = "$1.00";

    const verification = reconcileStandardReportWithCsv({
      report,
      mtdDailyRows: rows,
      selectedCampaigns: [campaign],
      reportType: "WEEKLY",
      timezone: "America/Los_Angeles",
      currencySymbol: "$",
      now,
      weeklyRange: { startIso: "2026-10-13", endIso: "2026-10-19" },
      resultCountingMode: "meta-csv-export",
    });

    const cprCheck = verification.checks.find(
      (c) => c.scope.includes("Ad set:") && c.metric.startsWith("COST PER"),
    );
    expect(cprCheck?.status).toBe("mismatch");
    expect(cprCheck?.note).toMatch(/must match spend ÷ results/i);
  });
});
