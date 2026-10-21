import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  blendedCostPerLinkClickFromRows,
  combinedCtrCpcFromRows,
  sumLinkClicksFromRows,
} from "../ctr-cpc";
import { parseCellNum } from "../format";
import { buildReportData } from "../report-data";
import { parseCsvText } from "../parse-csv";
import { filterNreRowsByDateRange } from "../date-range";

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "dc-weekly-the-belle-oct2026.csv");

describe("The Belle — CTR/CPC blended from CSV (not daily averages)", () => {
  it("weekly window matches independent CSV sums", () => {
    const { rows } = parseCsvText(readFileSync(FIXTURE, "utf8"));
    const weekRows = filterNreRowsByDateRange(rows, { startIso: "2026-10-13", endIso: "2026-10-19" });
    const { ctr: csvCtr, cpc: csvCpc } = combinedCtrCpcFromRows(weekRows);
    const csvLinkClicks = sumLinkClicksFromRows(weekRows);
    const csvCplc = blendedCostPerLinkClickFromRows(weekRows);

    const report = buildReportData({
      accountName: "The Belle",
      currencySymbol: "$",
      timezone: "America/Los_Angeles",
      monthlyBudget: null,
      mtdDailyRows: rows,
      now: new Date("2026-10-20T12:00:00Z"),
      reportType: "WEEKLY",
      selectedCampaigns: ["DC - LEADS - INSTANT FORMS - Q3 - JULY2026"],
      weeklyRange: { startIso: "2026-10-13", endIso: "2026-10-19" },
    });

    const slide = report.campaignSlides[0];
    expect(slide).toBeDefined();
    expect(parseCellNum(slide!.metrics.ctr)).toBeCloseTo(csvCtr, 2);
    expect(parseCellNum(slide!.metrics.cpc)).toBeCloseTo(csvCpc, 2);

    const linkCard = slide!.dynamicMetrics?.find((m) => m.key === "link_clicks");
    const cplcCard = slide!.dynamicMetrics?.find((m) => m.key === "cpc_link_click");
    expect(parseCellNum(linkCard?.value ?? "0")).toBe(csvLinkClicks);
    expect(parseCellNum(cplcCard?.value ?? "0")).toBeCloseTo(csvCplc, 2);

    // Sanity: CTR (all) is not implied by link clicks alone (would confuse 40% with 1 link click).
    if (csvLinkClicks > 0 && csvCtr > 0) {
      const impr = weekRows.reduce((s, r) => s + parseCellNum(r.impressions), 0);
      const impliedAllClicks = (csvCtr / 100) * impr;
      expect(impliedAllClicks).toBeGreaterThanOrEqual(csvLinkClicks);
    }
  });
});
