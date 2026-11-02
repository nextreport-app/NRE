import { describe, expect, it } from "vitest";
import { parseCsvText } from "../parse-csv";
import { dailyPeriodReach } from "../daily-period-reach";
import { buildDayBreakdownReportData } from "../day-breakdown-report-data";
import { buildReportData } from "../report-data";
import { reconcileDayBreakdownReportWithCsv } from "../csv-report-reconciliation";
const csv =
  parseCsvText(`Campaign name,Day,Amount spent (USD),Results,Result type,Reach,Impressions,Clicks (all)
Example,2026-10-30,10,2,website submission,100,200,10
Example,2026-10-31,10,1,website submission,80,100,5`);
const range = { startIso: "2026-10-30", endIso: "2026-10-31" };
const base = {
  accountName: "Example",
  currencySymbol: "$",
  timezone: "UTC",
  mtdDailyRows: csv.rows,
  csvHeaders: csv.headers,
  now: new Date("2026-11-01T12:00:00Z"),
};
describe("Daily selected-period Reach", () => {
  it("matches Weekly's period reach estimator instead of adding daily audience counts", () => {
    const daily = buildDayBreakdownReportData({ ...base, dateRange: range });
    const weekly = buildReportData({
      ...base,
      monthlyBudget: null,
      reportType: "WEEKLY",
      weeklyRange: range,
    });
    const reach = daily
      .presentation!.summaryPages.flat()
      .find((metric) => metric.key === "reach")!;
    expect(reach).toEqual({
      key: "reach",
      label: "REACH (EST.)",
      value: weekly.campaignSlides[0].metrics.reach,
    });
    expect(reach.value).toBe("129");
    expect(reach.value).not.toBe("180");
    expect(daily.dayRows.map((row) => row.reach)).toEqual(["100", "80"]);
    expect(
      reconcileDayBreakdownReportWithCsv({
        report: daily,
        mtdDailyRows: csv.rows,
        selectedCampaigns: null,
        currencySymbol: "$",
      }).status,
    ).toBe("ok");
    reach.value = "999";
    expect(
      reconcileDayBreakdownReportWithCsv({
        report: daily,
        mtdDailyRows: csv.rows,
        selectedCampaigns: null,
        currencySymbol: "$",
      }).status,
    ).toBe("mismatch");
  });
  it("distinguishes exported zeroes from blank, absent and partial Reach observations", () => {
    expect(
      dailyPeriodReach(
        csv.rows.map((row) => ({
          ...row,
          reach: "0",
          _raw: { ...row._raw, Reach: "0" },
        })),
      ),
    ).toBe(0);
    expect(
      dailyPeriodReach(
        csv.rows.map((row) => ({
          ...row,
          reach: "",
          _raw: { ...row._raw, Reach: "" },
        })),
      ),
    ).toBeNull();
    const missing = parseCsvText(
      "Campaign name,Day,Amount spent (USD),Impressions\nExample,2026-10-30,10,100",
    );
    expect(dailyPeriodReach(missing.rows)).toBeNull();
    expect(
      dailyPeriodReach([
        csv.rows[0],
        { ...csv.rows[1], _raw: { ...csv.rows[1]._raw, Reach: "" } },
      ]),
    ).toBeNull();
  });
  it("respects selected campaigns and dates before estimating period Reach", () => {
    const others = csv.rows.map((row) => ({
      ...row,
      campaign_name: "Other",
      reach: "900",
      _raw: { ...row._raw, "Campaign name": "Other", Reach: "900" },
    }));
    const data = buildDayBreakdownReportData({
      ...base,
      mtdDailyRows: [...csv.rows, ...others],
      selectedCampaigns: ["Example"],
      dateRange: range,
    });
    expect(
      data
        .presentation!.summaryPages.flat()
        .find((metric) => metric.key === "reach")?.value,
    ).toBe("129");
  });
});
