import { findGoogleMetricByKey } from "../nre/google-dictionary";
import { findMetaMetricByKey } from "../nre/meta-dictionary";
import type { ReportData } from "../nre/report-data";
import {metricDefinition,type LegendEntry} from "./legend-slide";

/** Collects distinct metric keys for the PPT/share Metric Guide — no server-only deps. */
export function collectLegendEntries(data: Pick<ReportData, "platform" | "campaignSlides" | "adSetSlides"> & Partial<Pick<ReportData,"metaContent" | "tableHeaderLabels">>): LegendEntry[] {
  if(data.metaContent?.includeStandard===false){
    const terms=new Set<string>(["AD SPEND","IMPRESSIONS","CTR (ALL)"]);
    for(const page of data.metaContent.pages){terms.add(page.objective);terms.add(page.costLabel);if(page.kind==="creative-preview"){terms.add("CPC (ALL)");terms.add("CPM");}if(page.rows.some(row=>row.roas!==null))terms.add("ROAS");if(page.rows.some(row=>row.websiteCvr!==null))terms.add("WEBSITE CVR");}
    return [...terms].map(term=>({term,explanation:metricDefinition(term)}));
  }
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
  // The overview contains these columns even when they were not selected as
  // campaign cards. Keep their units in the shared browser/PPTX glossary.
  if (data.platform === "META" && data.tableHeaderLabels) {
    for (const term of ["REACH", "IMPRESSIONS", "CTR (ALL)", "CPC (ALL)"]) {
      if (!entries.some(entry => entry.term === term)) entries.push({term, explanation: metricDefinition(term)});
    }
  }
  return entries;
}
