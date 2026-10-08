import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsvText } from "../parse-csv";
import { aggregateReach } from "../reach-aggregation";
import { metaCampaignPeriodReachMapsFromFlatWindow } from "../meta-api-sync/fetch-campaign-period-reach";
import { buildReportData } from "../report-data";
import type { MetricRow } from "../types";

const FIXTURE = resolve(__dirname, "fixtures/dc-weekly-southaven-reach.csv");
const REACH_CAMP = "SouthavenRV_Reach_Retargeting_April 9";

describe("Southaven reach campaign API period reach", () => {
  it("uses Ads Manager campaign reach instead of summed daily CSV reach", () => {
    const rows = parseCsvText(readFileSync(FIXTURE, "utf8")).rows;
    const start = "2026-09-06";
    const end = "2026-10-05";
    const reachRows: MetricRow[] = rows.filter(
      (r) => r.campaign_name === REACH_CAMP && (r.date_start ?? "") >= start && (r.date_start ?? "") <= end,
    );

    const naiveSum = reachRows.reduce((s, r) => s + Number(r.reach || 0), 0);
    expect(naiveSum).toBeGreaterThan(400_000);

    const heuristic = aggregateReach(reachRows);
    expect(heuristic).toBeGreaterThan(200_000);
    expect(heuristic).toBeLessThan(naiveSum);

    const maps = metaCampaignPeriodReachMapsFromFlatWindow(start, end, {
      [REACH_CAMP]: 135_358,
    });
    const apiReach = aggregateReach(reachRows, {
      metaCampaignPeriodReach: maps,
      periodRange: { startIso: start, endIso: end },
      scope: "campaign",
    });
    expect(apiReach).toBe(135_358);
  });

  it("puts API reach on the reach campaign slide when maps are supplied to buildReportData", () => {
    const rows = parseCsvText(readFileSync(FIXTURE, "utf8")).rows;
    const weeklyRange = { startIso: "2026-09-29", endIso: "2026-10-05" };
    const maps = metaCampaignPeriodReachMapsFromFlatWindow(weeklyRange.startIso, weeklyRange.endIso, {
      [REACH_CAMP]: 135_358,
    });
    const report = buildReportData({
      accountName: "Southaven",
      currencySymbol: "$",
      timezone: "America/Chicago",
      monthlyBudget: null,
      mtdDailyRows: rows,
      selectedCampaigns: [REACH_CAMP],
      weeklyRange,
      reportType: "WEEKLY",
      now: new Date("2026-10-06T12:00:00Z"),
      metaCampaignPeriodReach: maps,
    });
    const slide = report.campaignSlides.find((s) => s.campaignName === REACH_CAMP);
    expect(slide?.metrics.reach).toBe("135,358");
  });
});
