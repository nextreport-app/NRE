import { describe, expect, it } from "vitest";
import { buildChartKpiLayout } from "../../nre/chart-kpi-layout";
import type { ShareChartSnapshot } from "../../nre/share-report";
import { buildMtdChartSlideGeometry } from "../chart-slide-layout";

function multiSnapshot(): ShareChartSnapshot {
  return {
    mtdSpendLabel: "$3,401",
    primaryResultsValue: "32",
    primaryResultsLabel: "Meta Form Leads",
    primaryCprValue: "$88.26",
    primaryCprLabel: "Cost Per Meta Form Lead",
    budgetPctUsed: "19%",
    activeCampaignCount: 2,
    mode: "multi",
    objectives: [
      {
        label: "Meta Form Leads",
        resultsValue: "32",
        cprValue: "$88.26",
        cprLabel: "Cost Per Meta Form Lead",
        spendFormatted: "$2,824",
      },
      {
        label: "Website Leads",
        resultsValue: "0",
        cprValue: "—",
        cprLabel: "Cost Per Website Lead",
        spendFormatted: "$576",
      },
    ],
    objectivesOmittedCount: 0,
  };
}

describe("buildMtdChartSlideGeometry", () => {
  it("keeps single-mode donut below KPI tiles without overlap", () => {
    const layout = buildChartKpiLayout({
      mtdSpendLabel: "$500",
      primaryResultsValue: "10",
      primaryResultsLabel: "Purchases",
      primaryCprValue: "$50",
      primaryCprLabel: "Cost Per Purchase",
      budgetPctUsed: "10%",
      activeCampaignCount: 1,
      mode: "single",
      objectives: [
        {
          label: "Purchases",
          resultsValue: "10",
          cprValue: "$50",
          cprLabel: "Cost Per Purchase",
          spendFormatted: "$500",
        },
      ],
      objectivesOmittedCount: 0,
    });
    const geo = buildMtdChartSlideGeometry(layout);
    const kpiBottom = geo.accountKpi.y + geo.accountKpi.h;
    expect(geo.donut.y).toBeGreaterThanOrEqual(kpiBottom - 20);
    expect(geo.donut.y + geo.donut.d).toBeLessThanOrEqual(geo.footerY.ooxml);
  });

  it("places multi-mode donut and legend below objective blocks", () => {
    const layout = buildChartKpiLayout(multiSnapshot());
    const geo = buildMtdChartSlideGeometry(layout);
    expect(geo.mode).toBe("multi");
    expect(geo.objectiveKpi).not.toBeNull();

    const objectiveBottom = geo.objectiveKpi!.y + geo.objectiveKpi!.h;
    expect(geo.donut.y).toBeGreaterThanOrEqual(objectiveBottom);
    expect(geo.legend.y).toBeGreaterThanOrEqual(objectiveBottom);
    expect(geo.donut.y + geo.donut.d).toBeLessThanOrEqual(geo.footerY.ooxml + 4);
  });
});
