import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsvText } from "../parse-csv";
import { buildReportData } from "../report-data";
import { reconcileStandardReportWithCsv } from "../csv-report-reconciliation";
import { parseCellNum } from "../format";

const FIXTURE = resolve(__dirname, "fixtures/gz-australia-weekly-verify.csv");
const NOW = new Date("2026-10-05T12:00:00Z");
const TZ = "Australia/Sydney";
const CAMPAIGN = "GZ Australia | Lead Forms | Top Funnel | A3HD";

describe("CSV reconciliation — GZ Australia weekly export", () => {
  const rows = parseCsvText(readFileSync(FIXTURE, "utf8")).rows;

  it("MTD and report period spend match CSV (43.10 MTD, ~69 weekly)", () => {
    const weeklyRange = { startIso: "2026-09-28", endIso: "2026-10-04" };
    const report = buildReportData({
      accountName: "GZ",
      currencySymbol: "A$",
      timezone: TZ,
      monthlyBudget: null,
      mtdDailyRows: rows,
      selectedCampaigns: [CAMPAIGN],
      weeklyRange,
      reportType: "WEEKLY",
      now: NOW,
    });

    const verification = reconcileStandardReportWithCsv({
      report,
      mtdDailyRows: rows,
      selectedCampaigns: [CAMPAIGN],
      weeklyRange,
      reportType: "WEEKLY",
      timezone: TZ,
      currencySymbol: "A$",
      now: NOW,
    });

    expect(verification.status).toBe("ok");

    const mtdSpend = verification.checks.find((c) => c.scope === "Month-to-date" && c.metric === "Amount spent");
    expect(parseCellNum(mtdSpend?.csvDisplay ?? "")).toBeCloseTo(43.1, 0);
    expect(parseCellNum(mtdSpend?.reportDisplay ?? "")).toBeCloseTo(43.1, 0);
    expect(verification.checks.some((c) => c.scope === "Last 30 days (chart)")).toBe(true);

    const periodSpend = verification.checks.find(
      (c) => c.scope === "Weekly (last 7 days)" && c.metric === "Amount spent",
    );
    expect(parseCellNum(periodSpend?.csvDisplay ?? "")).toBeCloseTo(68.67, 0);
    expect(parseCellNum(periodSpend?.reportDisplay ?? "")).toBeCloseTo(68.67, 0);
  });
});
