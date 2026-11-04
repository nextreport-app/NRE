import { dailyMainTablePages } from "./daily-report-presentation";
import { paginateDayBreakdownRows } from "./day-breakdown-report-data";
import type { ShareReportData } from "./share-report";
import { adSetVisibilityKey, defaultShareVisibility } from "./share-report";

/** Slide counts the client will see after visibility is applied — pre-share editor summary. */
export function countVisibleSlides(share: ShareReportData): number {
  const vis = share.visibility ?? defaultShareVisibility(share);
  let n = vis.cover !== false ? 1 : 0;
  if (share.reportType === "DAY_BREAKDOWN") {
    if (vis.combinedTotal !== false && !share.isPaused) {
      n += share.dailyPresentation?.summaryPages.length ?? 0;
      n += dailyMainTablePages({ tableSlides: paginateDayBreakdownRows(share.historicalComparisonRows ?? []), tableHeaderLabels: share.tableHeaderLabels, additionalTables: share.dailyAdditionalTables, dailyExcludedMetricKeys: share.dailyExcludedMetricKeys }).length;
    }
    if (share.isPaused) n += 1;
    if (vis.metricGuide !== false && (share.metricGuide?.length ?? 0) > 0) n += 1;
    return n;
  }
  if (vis.overview !== false) n += share.historicalCharts?.length ?? 0;
  if (share.isPaused) {
    n += 1;
    if (vis.overview !== false && share.chart?.donutSegments?.length) n += 1;
    if (vis.combinedTotal !== false) n += 1;
    if (vis.metricGuide !== false && (share.metricGuide?.length ?? 0) > 0) n += 1;
    return n;
  }
  n += share.campaigns.filter((c) => vis.campaigns[c.campaignName] !== false).length;
  n += share.adSets.filter((a) => vis.adSets[adSetVisibilityKey(a.campaignName, a.adSetName)] !== false).length;
  if (vis.overview !== false && share.chart?.donutSegments?.length) n += 1;
  if (vis.combinedTotal !== false) n += 1;
  if (vis.metricGuide !== false && (share.metricGuide?.length ?? 0) > 0) n += 1;
  return n;
}
