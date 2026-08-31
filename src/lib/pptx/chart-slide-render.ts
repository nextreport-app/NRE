/**
 * Server-only chart slide assembly — native editable OOXML shapes.
 * Imported dynamically from render.ts so client bundles stay lean.
 */

import type { ChartSlideData } from "../nre/report-data";
import { projectChartSlideToShareChart } from "../nre/share-chart-projection";
import type { TemplateBackgroundImage } from "./package";
import { buildMtdOverviewSlideXml } from "./chart-slide-ooxml";
import { type ChartSlideRenderOptions } from "./chart-slide";

export interface ChartSlideBundle {
  xml: string;
}

/** Template background + native editable overview shapes (text, KPI cards, donut). */
export async function buildChartSlideBundle(
  chart: ChartSlideData,
  currencySymbol: string,
  background: TemplateBackgroundImage,
  isLightTemplate = false,
  _platform: "META" | "GOOGLE" = "META",
  _options: ChartSlideRenderOptions = {},
): Promise<ChartSlideBundle> {
  const shareChart = projectChartSlideToShareChart(chart, currencySymbol);
  return {
    xml: buildMtdOverviewSlideXml(shareChart, background, isLightTemplate),
  };
}
