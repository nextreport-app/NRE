import { fmtCurrency } from "./format";
import { buildDonutSegments, type DonutSegment } from "../pptx/chart-slide";
import type { ChartSlideData } from "./report-data";
import type { ShareChartData, ShareChartSnapshot, ShareDonutSegment } from "./share-report";
import { mapChartSnapshotObjective, toTitleCaseChartLabel } from "./chart-kpi-layout";

/** Footer insight under the donut — active campaigns only (budget % lives in the KPI tile). */
export function formatChartFooterInsight(activeCampaignCount: number, override?: string): string {
  if (override?.trim()) return override.trim();
  return `${activeCampaignCount} active campaign${activeCampaignCount === 1 ? "" : "s"} currently`;
}

export function resolveChartFooterInsight(chart: Pick<ShareChartData, "snapshot" | "footerInsight">): string {
  const base = formatChartFooterInsight(chart.snapshot.activeCampaignCount, chart.footerInsight);
  const omitted = chart.snapshot.objectivesOmittedCount ?? 0;
  if (omitted > 0) {
    return `${base} · ${omitted} more objective${omitted === 1 ? "" : "s"} on Combined Total slide`;
  }
  return base;
}

/** Spend-mix legend stats — clarifies that the % is share of total spend, not budget. */
export function formatDonutSegmentStats(percentage: number, spendLabel: string): string {
  const pctLabel = Number.isInteger(percentage) ? String(percentage) : String(percentage);
  return `${pctLabel}% of spend · ${spendLabel}`;
}

/** Shared projection from ChartSlideData → share-page chart shape (browser + PPT). */
export function projectChartSlideToShareChart(chart: ChartSlideData, currencySymbol: string): ShareChartData {
  const rangeSuffix = chart.periodSubLabel.length > 0 ? `: ${chart.periodSubLabel}` : "";
  const title = `${chart.mtdMonthName ?? "This month"} · Month to date overview${rangeSuffix}`;
  const subtitle = "Month to date performance · Where your budget went";
  const snap = chart.snapshot;
  const snapshot: ShareChartSnapshot = {
    mode: snap.mode,
    mtdSpendLabel: snap.mtdSpendFormatted,
    primaryResultsValue: snap.primaryResultsValue,
    primaryResultsLabel: toTitleCaseChartLabel(snap.primaryResultsLabel),
    primaryCprValue: snap.primaryCprValue,
    primaryCprLabel: toTitleCaseChartLabel(snap.primaryCprLabel),
    primarySpendFormatted: snap.primarySpendFormatted,
    budgetPctUsed: snap.budgetPctUsed,
    activeCampaignCount: snap.activeCampaignCount,
    objectives: snap.objectives.map((obj) =>
      mapChartSnapshotObjective({
        label: obj.label,
        resultsValue: obj.resultsValue,
        cprValue: obj.cprValue,
        cprLabel: obj.cprLabel,
        spendFormatted: obj.spendFormatted,
      }),
    ),
    objectivesOmittedCount: snap.objectivesOmittedCount ?? 0,
  };
  const donutSegments: ShareDonutSegment[] = buildDonutSegments(chart.campaigns, chart.totalAllSpend).map(
    (seg: DonutSegment) => ({
      name: seg.name,
      spendLabel: fmtCurrency(seg.spend, currencySymbol),
      percentage: seg.percentage,
      color: seg.color,
    }),
  );
  return {
    title,
    subtitle,
    snapshot,
    donutSegments,
    totalSpendLabel: fmtCurrency(chart.totalAllSpend, currencySymbol),
  };
}

export { buildChartKpiLayout, normalizeShareChartSnapshot, toTitleCaseChartLabel } from "./chart-kpi-layout";
