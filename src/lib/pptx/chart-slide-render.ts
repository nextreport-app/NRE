/**
 * Server-only chart slide assembly — rasterizes the browser React chart slide
 * to PNG for PPT/Slides. Imported dynamically from render.ts so client bundles
 * stay lean (Puppeteer + react-dom/server live in the PDF bundle only).
 */

import type { ChartSlideData } from "../nre/report-data";
import type { ShareChartData } from "../nre/share-report";
import { projectChartSlideToShareChart } from "../nre/share-chart-projection";
import type { TemplateBackgroundImage } from "./package";
import { buildPictureShapeXml } from "./embed-image";
import { rasterizeChartSlideToPng } from "./rasterize-chart-slide-png";
import { ptToEmu } from "./ooxml";
import { backgroundImage, buildBlankSlideXml, nextShapeId, resetShapeIdCounter } from "./shapes";
import {
  CHART_BG_REL_ID,
  CHART_OVERVIEW_MEDIA_FILE,
  CHART_OVERVIEW_REL_ID,
  type ChartSlideRenderOptions,
} from "./chart-slide";

export interface ChartSlideBundle {
  xml: string;
  mediaPath: string;
  mediaBytes: Uint8Array;
}

/** Template background + browser-identical chart PNG overlay. */
export async function buildChartSlideBundle(
  chart: ChartSlideData,
  currencySymbol: string,
  background: TemplateBackgroundImage,
  _isLightTemplate = false,
  _platform: "META" | "GOOGLE" = "META",
  _options: ChartSlideRenderOptions = {},
  shareChartOverride?: ShareChartData | null,
): Promise<ChartSlideBundle> {
  resetShapeIdCounter();
  const shareChart = shareChartOverride ?? projectChartSlideToShareChart(chart, currencySymbol);
  const mediaBytes = await rasterizeChartSlideToPng(shareChart);

  const shapes: string[] = [
    backgroundImage({ relId: CHART_BG_REL_ID, ...background }),
    buildPictureShapeXml({
      id: nextShapeId(),
      name: "Month to date overview",
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
