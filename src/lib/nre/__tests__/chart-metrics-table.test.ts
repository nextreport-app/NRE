import { describe, expect, it } from "vitest";
import { buildChartMetricsTable, CHART_SNAPSHOT_OBJECTIVE_MAX } from "../chart-metrics-table";
import type { ShareChartSnapshot } from "../share-report";

function multiSnapshot(objectiveCount = 2): ShareChartSnapshot {
  const objectives = Array.from({ length: objectiveCount }, (_, i) => ({
    label: `Objective ${i + 1}`,
    resultsValue: String(i * 3),
    cprValue: `$${10 + i}`,
    cprLabel: `Cost per objective ${i + 1}`,
    spendFormatted: `$${(i + 1) * 100}`,
  }));
  return {
    mode: "multi",
    mtdSpendLabel: "$3,401",
    primarySpendFormatted: objectives[0]?.spendFormatted,
    primaryResultsValue: objectives[0]?.resultsValue ?? "0",
    primaryResultsLabel: objectives[0]?.label ?? "Results",
    primaryCprValue: objectives[0]?.cprValue ?? "—",
    primaryCprLabel: objectives[0]?.cprLabel ?? "CPR",
    budgetPctUsed: "19%",
    activeCampaignCount: 2,
    objectives,
    objectivesOmittedCount: 0,
  };
}

describe("buildChartMetricsTable", () => {
  it("single objective — one data row plus budget row", () => {
    const table = buildChartMetricsTable({
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
      objectivesOmittedCount: 0,
    });
    expect(table.rows.map((r) => r.kind)).toEqual(["header", "objective", "budget"]);
    expect(table.rows[1]?.spend).toBe("$500");
    expect(table.rows[2]?.spend).toBe("19%");
  });

  it("multi objective — total row, objective rows, and budget row", () => {
    const table = buildChartMetricsTable(multiSnapshot(2));
    expect(table.rows.map((r) => r.kind)).toEqual(["header", "total", "objective", "objective", "budget"]);
    expect(table.rows.find((r) => r.kind === "total")?.spend).toBe("$3,401");
    expect(table.rows.filter((r) => r.kind === "objective")).toHaveLength(2);
  });

  it("fits eight objectives on one slide with compact row heights", () => {
    const table = buildChartMetricsTable(multiSnapshot(8));
    expect(table.rows.filter((r) => r.kind === "objective")).toHaveLength(8);
    expect(table.objectivesOmittedCount).toBe(0);
    expect(Math.min(...table.layout.rowHeights.filter((_, i) => table.rows[i]?.kind === "objective"))).toBeGreaterThanOrEqual(
      22,
    );
  });

  it("adds a footnote when objectives exceed visible capacity", () => {
    const table = buildChartMetricsTable(multiSnapshot(14), 200);
    expect(table.rows.some((r) => r.kind === "footnote")).toBe(true);
    expect(table.objectivesOmittedCount).toBeGreaterThan(0);
  });

  it("exports a generous storage cap for snapshot objectives", () => {
    expect(CHART_SNAPSHOT_OBJECTIVE_MAX).toBeGreaterThanOrEqual(12);
  });
});
