import { describe, expect, it } from "vitest";
import { buildChartMetricsTable } from "../../nre/chart-metrics-table";
import { MTD_DONUT, MTD_METRICS_TABLE, MTD_FOOTER_Y } from "../chart-slide-layout";
import { metricsTableTotalHeight } from "../chart-metrics-table-render";

describe("MTD chart slide layout constants", () => {
  it("keeps the original 220px donut design on the left", () => {
    expect(MTD_DONUT.d).toBe(220);
    expect(MTD_DONUT.outerR).toBe(110);
    expect(MTD_DONUT.cy).toBe(310);
  });

  it("places the metrics table on the right without overlapping the donut", () => {
    const donutRight = MTD_DONUT.x + MTD_DONUT.d;
    expect(MTD_METRICS_TABLE.x).toBeGreaterThanOrEqual(donutRight + 10);
  });

  it("keeps table and donut above the footer band", () => {
    const table = buildChartMetricsTable(
      {
        mode: "multi",
        mtdSpendLabel: "$3,401",
        primaryResultsValue: "32",
        primaryResultsLabel: "Meta form leads",
        primaryCprValue: "$88.26",
        primaryCprLabel: "Cost per lead",
        budgetPctUsed: "19%",
        activeCampaignCount: 2,
        objectives: [
          {
            label: "Meta form leads",
            resultsValue: "32",
            cprValue: "$88.26",
            cprLabel: "Cost per lead",
            spendFormatted: "$2,824",
          },
          {
            label: "Website leads",
            resultsValue: "0",
            cprValue: "N/A",
            cprLabel: "Cost per website lead",
            spendFormatted: "$576",
          },
        ],
      },
      MTD_METRICS_TABLE.maxH,
    );
    const tableBottom = MTD_METRICS_TABLE.y + metricsTableTotalHeight(table);
    expect(tableBottom).toBeLessThanOrEqual(MTD_FOOTER_Y.ooxml);
    expect(MTD_DONUT.y + MTD_DONUT.d).toBeLessThanOrEqual(MTD_FOOTER_Y.ooxml + 4);
  });
});
