import type { DailySummaryMetric } from "../nre/daily-report-presentation";
import type { CampaignSlideData } from "../nre/report-data";
import { dailySummaryMetrics } from "../nre/daily-summary-metrics";
import type { TemplateSlide } from "./package";
import { buildCampaignOrAdSetSlideXml } from "./fill-tags";

/** Use the actual Weekly template: same icons, gradients, typography and copy regions. */
export function buildDailySummarySlide(
  template: TemplateSlide,
  metrics: DailySummaryMetric[],
  accountName: string,
  heading: string,
  note: string,
  page: number,
  pages: number,
  light = false,
) {
  const blank = {
    spend: "",
    reach: "",
    impressions: "",
    results: "",
    ctr: "",
    cpr: "",
    cpc: "",
  };
  const slide: CampaignSlideData = {
    kind: "campaign",
    campaignName: `Selected campaigns · ${accountName}`,
    resultLabel: "RESULTS",
    costLabel: "COST PER RESULT",
    metrics: blank,
    performanceHeader: `SELECTED PERIOD TOTALS${pages > 1 ? ` (${page + 1}/${pages})` : ""}`,
    dateRangeLine: heading,
    avgFreq: 0,
    statusIndicator: null,
    dynamicMetrics: dailySummaryMetrics(metrics),
    ai: {
      ...blank,
      ctx: "",
      dateRange: heading,
      cpm: "",
      resultLabel: "RESULTS",
      costLabel: "COST PER RESULT",
      freq: 0,
      resultsNum: 0,
      hasResults: false,
      spendNum: 0,
      isInactive: false,
    },
  };
  return buildCampaignOrAdSetSlideXml(
    template,
    slide,
    {
      summary: `Performance totals for the selected campaigns across ${heading}.`,
      insights: note,
    },
    "WEEKLY",
    "META",
    false,
    true,
    light,
    true,
  );
}
