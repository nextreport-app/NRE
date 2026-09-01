import { describe, expect, it } from "vitest";
import { buildChartKpiCardRows, buildChartCampaignBars, computeMtdVisualBandMetrics } from "../chart-visual-layout";
import type { ShareChartSnapshot } from "../share-report";

describe("buildChartKpiCardRows", () => {
  it("single objective — three classic KPI cards", () => {
    const rows = buildChartKpiCardRows({
      mode: "single",
      mtdSpendLabel: "$500",
      primarySpendFormatted: "$500",
      primaryResultsValue: "10",
      primaryResultsLabel: "Purchases",
      primaryCprValue: "$50",
      primaryCprLabel: "Cost per purchase",
      budgetPctUsed: "19%",
      activeCampaignCount: 1,
      objectives: [
        {
          label: "Purchases",
          resultsValue: "10",
          cprValue: "$50",
          cprLabel: "Cost per purchase",
          spendFormatted: "$500",
        },
      ],
    });
    expect(rows.mode).toBe("single");
    expect(rows.rows[0]).toHaveLength(3);
    expect(rows.rows[0]?.[0]?.value).toBe("$500");
  });

  it("multi objective — account row plus one card per objective", () => {
    const rows = buildChartKpiCardRows({
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
    });
    expect(rows.mode).toBe("multi");
    expect(rows.rows[0]?.map((c) => c.value)).toEqual(["$3,401"]);
    expect(rows.rows[1]).toHaveLength(2);
    expect(rows.rows[1]?.[1]?.detail).toContain("$576");
  });
});

describe("computeMtdVisualBandMetrics", () => {
  it("keeps the 220px donut below KPI cards without overlapping the footer", () => {
    const cardRows = buildChartKpiCardRows({
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
    });
    const bars = buildChartCampaignBars([
      { name: "A", spendLabel: "$100", percentage: 60, color: "f6ad55" },
      { name: "B", spendLabel: "$60", percentage: 40, color: "63b3ed" },
    ]);
    const band = computeMtdVisualBandMetrics(cardRows, bars.length);
    expect(band.donutY + 220).toBeLessThanOrEqual(488);
    expect(band.donutY).toBeGreaterThanOrEqual(200);
  });
});
