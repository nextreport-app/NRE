import { describe, expect, it } from "vitest";
import { parseCsvText } from "../parse-csv";
import { buildDayBreakdownReportData } from "../day-breakdown-report-data";
import { dailyClientCopy } from "../daily-client-copy";
const csv =
  parseCsvText(`Campaign name,Day,Amount spent (USD),Results,Result type,Reach,Impressions,Clicks (all),CTR (all),CPC (all)
Example,2026-10-01,100,5,website submission,100,1000,100,10,1
Example,2026-10-02,50,0,website submission,80,100,5,5,10`);
const build = (extra = {}) =>
  buildDayBreakdownReportData({
    accountName: "Example",
    currencySymbol: "$",
    timezone: "UTC",
    mtdDailyRows: csv.rows,
    csvHeaders: csv.headers,
    dateRange: { startIso: "2026-10-01", endIso: "2026-10-02" },
    ...extra,
  });
describe("client-facing Daily copy", () => {
  it("uses the whole period across summary continuation pages, with actual spend, results and weighted rates", () => {
    const data = build();
    const copy = dailyClientCopy(
      data.presentation!.summaryPages.flat(),
      data.dayRows,
    );
    expect(copy.summary).toContain(
      "spent $150 and generated 5 website leads at $30.00 per website lead",
    );
    expect(copy.summary).toContain("9.55%");
    expect(copy.summary).toContain("$1.43");
    expect(copy.summary).toContain("1,100 impressions");
    expect(copy.insights).toContain(
      "Daily website leads peaked at 5 on Oct 1, 2026.",
    );
    expect(copy.insights).toContain(
      "Total reach is unavailable for this period.",
    );
    expect(copy.summary.length).toBeLessThanOrEqual(300);
    expect(copy.insights.length).toBeLessThanOrEqual(400);
    expect(JSON.stringify(copy)).not.toMatch(
      /CSV|averaged|Performance totals|improved|declined/,
    );
  });
  it("does not reintroduce removed metrics in the narrative", () => {
    const data = build({
      dailyExcludedMetricKeys: [
        "spend",
        "reach",
        "ctr",
        "cpc_all",
        "objective_results",
        "objective_cost",
      ],
    });
    const copy = dailyClientCopy(
      data.presentation!.summaryPages.flat(),
      data.dayRows,
    );
    expect(copy.summary).toContain("1,100 impressions");
    expect(JSON.stringify(copy)).not.toMatch(
      /website leads|spend|spent|reach|CPC|CTR/,
    );
  });
  it("keeps different objectives separate and identifies ties without claiming a unique best day", () => {
    const data = build();
    const metrics = data.presentation!.summaryPages.flat();
    const copy = dailyClientCopy(
      [
        ...metrics,
        { key: "objective_results:PURCHASES", label: "PURCHASES", value: "2" },
        {
          key: "objective_cost:PURCHASES",
          label: "COST PER PURCHASE",
          value: "$10.00",
        },
      ],
      [data.dayRows[0], { ...data.dayRows[0], monthLabel: "Oct 2, 2026" }],
    );
    expect(copy.summary).toContain("5 website leads");
    expect(copy.summary).toContain("2 purchases");
    expect(copy.insights).toContain("on 2 days, including Oct 1, 2026");
    expect(copy.summary).not.toContain("7 results");
    expect(copy.insights).not.toContain("No purchases");
  });
  it("keeps zero results factual without a fabricated cost per result", () => {
    const data = build();
    const metrics = data
      .presentation!.summaryPages.flat()
      .map((metric) =>
        metric.key.startsWith("objective_results:")
          ? { ...metric, value: "0" }
          : metric.key.startsWith("objective_cost:")
            ? { ...metric, value: "N/A" }
            : metric,
      );
    const copy = dailyClientCopy(metrics, [data.dayRows[1]]);
    expect(copy.summary).toContain("0 website leads");
    expect(copy.summary).not.toContain("N/A per");
    expect(copy.insights).toContain("No website leads were recorded");
  });
});
