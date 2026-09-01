import { fmtCurrency } from "./format";
import type { ResultGroup } from "./objective";
import { CHART_SNAPSHOT_OBJECTIVE_MAX } from "./chart-metrics-table";

export { CHART_SNAPSHOT_OBJECTIVE_MAX as CHART_SNAPSHOT_OBJECTIVE_CAP } from "./chart-metrics-table";

export interface ChartSnapshotObjective {
  label: string;
  resultsValue: string;
  cprValue: string;
  cprLabel: string;
  spendFormatted: string;
}

export interface ChartSnapshotKpis {
  mode: "single" | "multi";
  /** Account-level total MTD spend (all objectives). */
  mtdSpendFormatted: string;
  budgetPctUsed: string;
  activeCampaignCount: number;
  objectives: ChartSnapshotObjective[];
  /** Objectives beyond CHART_SNAPSHOT_OBJECTIVE_CAP (Combined Total has the full set). */
  objectivesOmittedCount: number;
  /** Legacy + single-mode tiles — first objective by spend. */
  primaryResultsValue: string;
  primaryResultsLabel: string;
  primaryCprValue: string;
  primaryCprLabel: string;
  /** Objective-scoped spend for single-mode spend tile. */
  primarySpendFormatted: string;
}

export function buildChartSnapshotKpis(params: {
  mtdResultColumns: { label: string; value: string; cprValue: string; costLabel: string }[];
  mtdGroups: ResultGroup[];
  totalAllSpendFormatted: string;
  budgetPctUsed: string | null;
  activeCampaignCount: number;
  currencySymbol: string;
}): ChartSnapshotKpis {
  const objectives: ChartSnapshotObjective[] = params.mtdResultColumns.map((col) => {
    const group = params.mtdGroups.find((g) => g.label === col.label);
    return {
      label: col.label,
      resultsValue: col.value,
      cprValue: col.cprValue,
      cprLabel: col.costLabel,
      spendFormatted: fmtCurrency(group?.totalSpend ?? 0, params.currencySymbol),
    };
  });

  const omitted = Math.max(0, objectives.length - CHART_SNAPSHOT_OBJECTIVE_MAX);
  const stored = objectives.slice(0, CHART_SNAPSHOT_OBJECTIVE_MAX);
  const primary = objectives[0] ?? {
    label: "RESULTS",
    resultsValue: "0",
    cprValue: "—",
    cprLabel: "COST PER RESULT",
    spendFormatted: params.totalAllSpendFormatted,
  };

  return {
    mode: objectives.length >= 2 ? "multi" : "single",
    mtdSpendFormatted: params.totalAllSpendFormatted,
    budgetPctUsed: params.budgetPctUsed ?? "",
    activeCampaignCount: params.activeCampaignCount,
    objectives: stored,
    objectivesOmittedCount: omitted,
    primaryResultsValue: primary.resultsValue,
    primaryResultsLabel: primary.label,
    primaryCprValue: primary.cprValue,
    primaryCprLabel: primary.cprLabel,
    primarySpendFormatted: primary.spendFormatted,
  };
}
