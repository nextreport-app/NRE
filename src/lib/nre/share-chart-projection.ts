import { fmtCurrency } from "./format";
import { buildDonutSegments, type DonutSegment } from "../pptx/chart-slide";
import type { ChartSlideData } from "./report-data";
import type { ShareChartData, ShareChartSnapshot, ShareDonutSegment } from "./share-report";

const KNOWN_METRIC_ACRONYMS = new Set(["LPV", "CPM", "1K"]);

function toTitleCase(label: string): string {
  return label
    .split(" ")
    .map((w) => (KNOWN_METRIC_ACRONYMS.has(w) ? w : w.length > 0 ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

/** Footer insight under the donut — active campaigns only (budget % lives in the KPI tile). */
export function formatChartFooterInsight(activeCampaignCount: number): string {
  return `${activeCampaignCount} active campaign${activeCampaignCount === 1 ? "" : "s"} this month`;
}

/** Shared projection from ChartSlideData → share-page chart shape (browser + PPT). */
export function projectChartSlideToShareChart(chart: ChartSlideData, currencySymbol: string): ShareChartData {
  const rangeSuffix = chart.periodSubLabel.length > 0 ? `: ${chart.periodSubLabel}` : "";
  const title = `${chart.mtdMonthName ?? "This month"} · Month to date overview${rangeSuffix}`;
  const subtitle = "Month to date performance · Where your budget went";
  const snap = chart.snapshot;
  const snapshot: ShareChartSnapshot = {
    mtdSpendLabel: snap.mtdSpendFormatted,
    primaryResultsValue: snap.primaryResultsValue,
    primaryResultsLabel: toTitleCase(snap.primaryResultsLabel),
    primaryCprValue: snap.primaryCprValue,
    primaryCprLabel: toTitleCase(snap.primaryCprLabel),
    budgetPctUsed: snap.budgetPctUsed,
    activeCampaignCount: snap.activeCampaignCount,
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
