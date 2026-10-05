import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsvText } from "../parse-csv";
import { buildReportData } from "../report-data";
import { reconcileStandardReportWithCsv } from "../csv-report-reconciliation";
import { parseCellNum } from "../format";

const FIXTURE = resolve(__dirname, "fixtures/bumpertech-weekly-oct.csv");
const NOW = new Date("2026-10-06T12:00:00Z");
const TZ = "Australia/Sydney";

describe("CSV reconciliation — BumperTech chart + weekly scopes", () => {
  const rows = parseCsvText(readFileSync(FIXTURE, "utf8")).rows;
  const allCampaigns = [...new Set(rows.map((r) => String(r.campaign_name || "").trim()).filter(Boolean))];
  const selected = allCampaigns.filter((c) => !c.toLowerCase().includes("re-targeting"));
  const weeklyRange = { startIso: "2026-09-29", endIso: "2026-10-05" };

  it("green verification when MTD, weekly, and last-30 chart match CSV (189 quotes)", () => {
    const report = buildReportData({
      accountName: "BumperTech",
      currencySymbol: "A$",
      timezone: TZ,
      monthlyBudget: null,
      mtdDailyRows: rows,
      selectedCampaigns: selected,
      weeklyRange,
      reportType: "WEEKLY",
      now: NOW,
    });

    const verification = reconcileStandardReportWithCsv({
      report,
      mtdDailyRows: rows,
      selectedCampaigns: selected,
      weeklyRange,
      reportType: "WEEKLY",
      timezone: TZ,
      currencySymbol: "A$",
      now: NOW,
    });

    expect(verification.status).toBe("ok");

    const chartQuotes = verification.checks.find(
      (c) => c.scope === "Last 30 days (chart)" && c.metric === "QUOTE REQUESTS",
    );
    expect(chartQuotes?.status).toBe("ok");
    expect(parseCellNum(chartQuotes?.reportDisplay ?? "0")).toBe(189);
    expect(parseCellNum(chartQuotes?.csvDisplay ?? "0")).toBe(189);

    const scopes = new Set(verification.checks.map((c) => c.scope));
    expect(scopes.has("Month-to-date")).toBe(true);
    expect(scopes.has("Weekly (last 7 days)")).toBe(true);
    expect(scopes.has("Last 30 days (chart)")).toBe(true);
  });
});
