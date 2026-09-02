import { describe, expect, it } from "vitest";
import { buildMtdOverviewSvg } from "../chart-overview-svg";
import { rasterizeSvgToPng } from "../svg-to-png";

describe("rasterizeSvgToPng", () => {
  it("produces a substantial PNG with readable text when fonts are bundled", async () => {
    const svg = buildMtdOverviewSvg({
      title: "Last 30 Days Campaign Performance: Aug 1 - Aug 20, 2026",
      subtitle: "Month to date performance",
      snapshot: {
        mtdSpendLabel: "$100",
        primaryResultsValue: "10",
        primaryResultsLabel: "Purchases",
        primaryCprValue: "$10.00",
        primaryCprLabel: "Cost per purchase",
        budgetPctUsed: "19%",
        activeCampaignCount: 1,
      },
      donutSegments: [{ name: "A", spendLabel: "$100", percentage: 100, color: "f6ad55" }],
      totalSpendLabel: "$100",
      visualSlide: {
        title: "Last 30 Days Campaign Performance: Aug 1 - Aug 20, 2026",
        isMultiObjective: false,
        leftHeading: "BUDGET DISTRIBUTION",
        rightHeading: "Purchases by Campaign",
        miniDonuts: [{ name: "A", spendLabel: "$100", pctLabel: "100%", color: "f6ad55" }],
        groupedDonut: null,
        groupedDonutCenterLabel: "$100",
        resultBars: [
          {
            name: "A",
            color: "f6ad55",
            resultCount: 10,
            resultLine: "10 purchases",
            costLine: "$10.00 CPP",
            statLine: "10 purchases $10.00 CPP",
            barPct: 100,
          },
        ],
        summaryLine: "Total Spend: $100 · Total Purchases: 10",
      },
    });
    const png = await rasterizeSvgToPng(svg);
    expect(png[0]).toBe(0x89);
    expect(png[1]).toBe(0x50);
    // Without bundled fonts PNGs are ~30KB and mostly empty; with fonts ~80KB+.
    expect(png.length).toBeGreaterThan(50_000);
  });
});
