/**
 * Applies published share-page edits (metrics + copy already in share JSON)
 * onto the frozen generation-time ReportData before PPT re-render.
 */

import type { DynamicMetricValue } from "./dynamic-metrics";
import type { ReportData } from "./report-data";
import type { ShareReportData } from "./share-report";

function patchMetricSlots(
  slots: (DynamicMetricValue | null)[] | undefined,
  shared: DynamicMetricValue[],
): (DynamicMetricValue | null)[] | undefined {
  if (!slots) return slots;
  const byKey = new Map(shared.map((m) => [m.key, m.value]));
  return slots.map((m) => (m && byKey.has(m.key) ? { ...m, value: byKey.get(m.key)! } : m));
}

/** Merge share.campaigns / share.adSets metric values into archive ReportData for PPT regeneration. */
export function applyShareEditsToReportData(data: ReportData, share: ShareReportData): ReportData {
  const campaignMetrics = new Map(share.campaigns.map((c) => [c.campaignName, c.metrics]));
  const adSetMetrics = new Map(share.adSets.map((a) => [`${a.campaignName}\0${a.adSetName}`, a.metrics]));

  const cover = {
    ...data.cover,
    accountName: share.accountName ?? data.cover.accountName,
    dateRange: share.cover?.dateRange ?? data.cover.dateRange,
    healthBadge: share.cover?.healthBadge ?? data.cover.healthBadge,
    healthScore: share.cover?.healthScore ?? data.cover.healthScore,
    reportDate: share.cover?.reportDate ?? data.cover.reportDate,
    budgetSummary: "",
  };

  const campaignSlides = data.campaignSlides.map((slide) => {
    const shared = campaignMetrics.get(slide.campaignName);
    if (!shared) return slide;
    return {
      ...slide,
      dynamicMetrics: patchMetricSlots(slide.dynamicMetrics, shared) ?? slide.dynamicMetrics,
      additionalMetricsSlide: patchMetricSlots(slide.additionalMetricsSlide, shared),
    };
  });

  const adSetSlides = data.adSetSlides.map((slide) => {
    const shared = adSetMetrics.get(`${slide.campaignName}\0${slide.adSetName}`);
    if (!shared) return slide;
    return {
      ...slide,
      dynamicMetrics: patchMetricSlots(slide.dynamicMetrics, shared) ?? slide.dynamicMetrics,
      additionalMetricsSlide: patchMetricSlots(slide.additionalMetricsSlide, shared),
    };
  });

  return { ...data, cover, campaignSlides, adSetSlides, periodRow: share.periodRow, mtdRow: share.mtdRow };
}
