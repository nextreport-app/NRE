import { fmtCurrency, fmtCurrencyAdaptive } from "./format";
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
  activeCampaignCount: number;
  currencySymbol: string;
  /** Full campaign spend per objective — chart donut uses this instead of row-filtered mtdGroups spend. */
  campaignSpendByObjective?: Map<string, number>;
}): ChartSnapshotKpis {
  const objectives: ChartSnapshotObjective[] = params.mtdResultColumns.map((col) => {
    const group = params.mtdGroups.find((g) => g.label === col.label);
    const campaignSpend = params.campaignSpendByObjective?.get(col.label);
    const spend =
      campaignSpend !== undefined ? campaignSpend : (group?.totalSpend ?? 0);
    return {
      label: col.label,
      resultsValue: col.value,
      cprValue: col.cprValue,
      cprLabel: col.costLabel,
      spendFormatted:
        campaignSpend !== undefined
          ? fmtCurrencyAdaptive(spend, params.currencySymbol)
          : fmtCurrency(spend, params.currencySymbol),
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
