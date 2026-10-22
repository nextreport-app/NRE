import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { splitMtdDaily } from "../aggregate";
import { buildReportData } from "../report-data";
import { combinedCtrCpcFromRows } from "../ctr-cpc";
import { parseCsvText } from "../parse-csv";
import { parseCellNum } from "../format";

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "ski-summit-leads-form-weekly.csv");

describe("blended CTR/CPC (Meta formulas, not averaged daily %)", () => {
  it("campaign slide matches spend÷clicks and clicks÷impressions×100 for weekly Ski Summit export", () => {
    const rows = parseCsvText(readFileSync(FIXTURE, "utf8")).rows;
    const now = new Date("2026-10-20T12:00:00Z");
    const data = buildReportData({
      accountName: "Ski Summit Homes",
      currencySymbol: "$",
      timezone: "America/Denver",
      monthlyBudget: null,
      mtdDailyRows: rows,
      now,
      reportType: "WEEKLY",
    });
    const slide = data.campaignSlides[0];
    expect(slide).toBeDefined();
    const split = splitMtdDaily(rows, now, { timezone: "America/Denver" });
    const weeklyRaw = (split?.weeklyRawRows ?? []).filter((r) =>
      String(r.campaign_name).includes("New Leads"),
    );
    const { ctr, cpc } = combinedCtrCpcFromRows(weeklyRaw);
    expect(slide!.metrics.ctr).toBe(`${ctr.toFixed(2)}%`);
    expect(slide!.metrics.cpc).toBe(`$${cpc.toFixed(2)}`);
    expect(parseCellNum(slide!.metrics.ctr)).not.toBeCloseTo(18.28, 0);
  });
});
