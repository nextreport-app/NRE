import type { TemplateBackgroundImage } from "./package";
import type { ComparisonExtraMetric } from "../nre/comparison-extra-metrics";
import { buildComparisonMetricSlideXml } from "./comparison-slides";

/** Continuation pages share the default slide's exact card and badge renderer. */
export function buildComparisonExtraSlide(input: { periodATitle?: string; periodBTitle?: string; campaignName: string; metrics: ComparisonExtraMetric[]; periodALabel: string; periodBLabel: string; page: number; pages: number; background: TemplateBackgroundImage; isLightTemplate: boolean }): string {
  return buildComparisonMetricSlideXml(input.campaignName, input.metrics.map(metric => ({
    key: metric.key,
    label: metric.label,
    valueA: metric.formattedA,
    valueB: metric.formattedB,
    unavailable: metric.percent === null,
    change: { percent: metric.percent, direction: metric.percent === null ? "new" : metric.percent > 0 ? "up" : metric.percent < 0 ? "down" : "flat" },
  })), input.periodALabel, input.periodBLabel, input.background, input.isLightTemplate,
  `ADDITIONAL COMPARISON METRICS · ${input.page + 1} of ${input.pages}${input.metrics.some(metric => metric.percent === null) ? " · N/A: unavailable value or zero comparison baseline" : ""}`, { a: input.periodATitle ?? "PERIOD A", b: input.periodBTitle ?? "PERIOD B" });
}
