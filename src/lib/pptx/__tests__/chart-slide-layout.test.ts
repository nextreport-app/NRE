import { describe, expect, it } from "vitest";
import { buildChartKpiCardRows, buildChartCampaignBars, computeMtdVisualBandMetrics } from "../../nre/chart-visual-layout";
import { MTD_DONUT_D, MTD_DONUT_OUTER_R, MTD_FOOTER_Y } from "../chart-slide-layout";

describe("MTD chart slide layout constants", () => {
  it("keeps the original 220px donut design", () => {
    expect(MTD_DONUT_D).toBe(220);
    expect(MTD_DONUT_OUTER_R).toBe(110);
  });

  it("fits KPI cards, donut, and campaign bars above the footer", () => {
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
      { name: "Campaign A", spendLabel: "$2,000", percentage: 58, color: "f6ad55" },
      { name: "Campaign B", spendLabel: "$1,400", percentage: 42, color: "63b3ed" },
    ]);
    const band = computeMtdVisualBandMetrics(cardRows, bars.length);
    expect(band.donutY + MTD_DONUT_D).toBeLessThanOrEqual(MTD_FOOTER_Y.ooxml + 8);
  });
});
