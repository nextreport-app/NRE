import { describe, expect, it } from "vitest";
import { buildChartKpiLayout, normalizeShareChartSnapshot } from "../chart-kpi-layout";
import type { ShareChartSnapshot } from "../share-report";

describe("buildChartKpiLayout", () => {
  it("single objective — spend tile uses objective-scoped spend, not account total", () => {
    const snapshot: ShareChartSnapshot = {
      mode: "single",
      mtdSpendLabel: "$3,401",
      primarySpendFormatted: "$2,824",
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
      ],
      objectivesOmittedCount: 0,
    };
    const layout = buildChartKpiLayout(snapshot);
    expect(layout.mode).toBe("single");
    expect(layout.accountTiles[0]?.value).toBe("$2,824");
    expect(layout.accountTiles[1]?.value).toBe("32");
  });

  it("multi objective — account row shows total spend + budget; each objective gets its own block", () => {
    const snapshot: ShareChartSnapshot = {
      mode: "multi",
      mtdSpendLabel: "$3,401",
      primarySpendFormatted: "$2,824",
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
      objectivesOmittedCount: 0,
    };
    const layout = buildChartKpiLayout(snapshot);
    expect(layout.mode).toBe("multi");
    expect(layout.accountTiles.map((t) => t.value)).toEqual(["$3,401", "19%"]);
    expect(layout.objectiveBlocks).toHaveLength(2);
    expect(layout.objectiveBlocks[1]?.spendFormatted).toBe("$576");
  });

  it("normalizes legacy snapshots without mode/objectives", () => {
    const legacy = normalizeShareChartSnapshot({
      mtdSpendLabel: "$100",
      primaryResultsValue: "5",
      primaryResultsLabel: "Leads",
      primaryCprValue: "$20",
      primaryCprLabel: "Cost per lead",
      budgetPctUsed: "",
      activeCampaignCount: 1,
      objectives: [],
    });
    expect(legacy.mode).toBe("single");
    expect(legacy.objectives).toHaveLength(1);
  });
});
