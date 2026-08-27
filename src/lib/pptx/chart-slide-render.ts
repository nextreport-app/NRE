/**
 * Server-only chart slide assembly — rasterizes overview SVG to PNG for PPT/Slides.
 * Imported dynamically from render.ts so client bundles never pull in resvg.
 */

import type { ChartSlideData } from "../nre/report-data";
import { projectChartSlideToShareChart } from "../nre/share-chart-projection";
import type { TemplateBackgroundImage } from "./package";
import { buildPictureShapeXml } from "./embed-image";
import { buildMtdOverviewSvg } from "./chart-overview-svg";
import { rasterizeSvgToPng } from "./svg-to-png";
import { ptToEmu } from "./ooxml";
import { buildBlankSlideXml, nextShapeId, resetShapeIdCounter } from "./shapes";
import { CHART_OVERVIEW_MEDIA_FILE, CHART_OVERVIEW_REL_ID, type ChartSlideRenderOptions } from "./chart-slide";

export interface ChartSlideBundle {
  xml: string;
  mediaPath: string;
  mediaBytes: Uint8Array;
}

/** Builds chart slide as one full-slide PNG (browser-matching, opaque). */
export async function buildChartSlideBundle(
  chart: ChartSlideData,
  currencySymbol: string,
  _background: TemplateBackgroundImage,
  _isLightTemplate = false,
  _platform: "META" | "GOOGLE" = "META",
  _options: ChartSlideRenderOptions = {},
): Promise<ChartSlideBundle> {
  resetShapeIdCounter();
  const shareChart = projectChartSlideToShareChart(chart, currencySymbol);
  const svg = buildMtdOverviewSvg(shareChart);
  const mediaBytes = await rasterizeSvgToPng(svg);

  const shapes: string[] = [
    buildPictureShapeXml({
      id: nextShapeId(),
      name: "MTD Overview",
      relId: CHART_OVERVIEW_REL_ID,
      x: 0,
      y: 0,
      cx: ptToEmu(960),
      cy: ptToEmu(540),
    }),
  ];

  return {
    xml: buildBlankSlideXml(shapes),
    mediaPath: `ppt/media/${CHART_OVERVIEW_MEDIA_FILE}`,
    mediaBytes,
  };
}
