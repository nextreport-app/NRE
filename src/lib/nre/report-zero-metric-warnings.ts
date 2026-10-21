/**
 * Slide preview — collect metric card labels that will display 0 before the
 * user generates or downloads. Catches Meta export glitches (missing Reach)
 * even when the CSV column header exists but is empty, or when the column
 * was never mapped.
 */

import type { DynamicMetricValue } from "./dynamic-metrics";
import { parseCellNum } from "./format";
import type { AdSetSlideData, CampaignSlideData, ReportData } from "./report-data";

type PerformanceSlide = CampaignSlideData | AdSetSlideData;

export function isZeroMetricDisplayValue(value: string): boolean {
  const v = value.trim();
  if (!v || v === "—" || v === "-") return false;
  return parseCellNum(v) === 0;
}

function zeroLabelsFromCards(metrics: (DynamicMetricValue | null)[] | undefined): string[] {
  const out: string[] = [];
  for (const metric of metrics ?? []) {
    if (!metric) continue;
    if (isZeroMetricDisplayValue(metric.value)) out.push(metric.label);
  }
  return out;
}

/** Unique metric labels (as on slides) that read 0 while the slide has spend. */
export function collectZeroMetricLabelsFromReport(report: ReportData): string[] {
  const labels = new Set<string>();
  const slides: PerformanceSlide[] = [...report.campaignSlides, ...report.adSetSlides];

  for (const slide of slides) {
    if (slide.ai.spendNum <= 0) continue;
    for (const label of zeroLabelsFromCards(slide.dynamicMetrics)) labels.add(label);
    for (const label of zeroLabelsFromCards(slide.additionalMetricsSlide)) labels.add(label);
  }

  return [...labels].sort((a, b) => a.localeCompare(b));
}
