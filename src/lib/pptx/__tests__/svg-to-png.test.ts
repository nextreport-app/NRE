import { describe, expect, it } from "vitest";
import { buildMtdOverviewSvg } from "../chart-overview-svg";
import { rasterizeSvgToPng } from "../svg-to-png";

describe("rasterizeSvgToPng", () => {
  it("produces a valid PNG from chart overview SVG", async () => {
    const svg = buildMtdOverviewSvg({
      title: "August MTD Overview",
      subtitle: "Month-to-date performance",
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
    });
    const png = await rasterizeSvgToPng(svg);
    expect(png[0]).toBe(0x89);
    expect(png[1]).toBe(0x50);
    expect(png.length).toBeGreaterThan(1000);
  });
});
