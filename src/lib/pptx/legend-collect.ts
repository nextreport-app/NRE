import { findGoogleMetricByKey } from "../nre/google-dictionary";
import { findMetaMetricByKey } from "../nre/meta-dictionary";
import type { ReportData } from "../nre/report-data";
import type { LegendEntry } from "./legend-slide";

/** Collects distinct metric keys for the PPT/share Metric Guide — no server-only deps. */
export function collectLegendEntries(data: ReportData): LegendEntry[] {
  const seen = new Set<string>();
  const entries: LegendEntry[] = [];
  const findByKey = data.platform === "GOOGLE" ? findGoogleMetricByKey : findMetaMetricByKey;

  for (const slide of [...data.campaignSlides, ...data.adSetSlides]) {
    for (const metric of [...(slide.dynamicMetrics ?? []), ...(slide.additionalMetricsSlide ?? [])]) {
      if (!metric || metric.key === "spend" || seen.has(metric.key)) continue;
      seen.add(metric.key);
      const dictEntry = findByKey(metric.key);
      entries.push({ term: metric.label, explanation: dictEntry?.explanation ?? metric.label });
    }
  }
  return entries;
}
