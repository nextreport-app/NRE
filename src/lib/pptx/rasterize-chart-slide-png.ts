/**
 * Rasterizes the live share-page chart slide (ShareMtdOverviewSlide) to PNG
 * via Puppeteer — pixel-identical to the browser, unlike hand-maintained SVG/OOXML.
 */

import type { ShareChartData } from "../nre/share-report";
import { launchPuppeteerBrowser } from "../pdf/puppeteer-browser";
import { CHART_OVERVIEW_PNG_WIDTH_PX } from "./svg-to-png";

/** Slide is 960×540pt — render at 2× for crisp Google Slides conversion. */
export const CHART_OVERVIEW_PNG_HEIGHT_PX = 1080;

// Prebuilt by scripts/build-pdf-html-bundle.mjs
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { buildPrintChartSlideHtml } = require("../pdf/print-report-html.bundle.cjs") as {
  buildPrintChartSlideHtml: (chart: ShareChartData) => string;
};

export async function rasterizeChartSlideToPng(chart: ShareChartData): Promise<Uint8Array> {
  const html = buildPrintChartSlideHtml(chart);
  const browser = await launchPuppeteerBrowser();

  try {
    const page = await browser.newPage();
    const scale = CHART_OVERVIEW_PNG_WIDTH_PX / 960;
    await page.setViewport({
      width: 960,
      height: 540,
      deviceScaleFactor: scale,
    });
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.waitForSelector("#chart-slide-capture", { timeout: 30_000 });
    await page.evaluate(() => document.fonts.ready).catch(() => undefined);

    const element = await page.$("#chart-slide-capture");
    if (!element) {
      throw new Error("Chart slide capture element not found");
    }

    const png = await element.screenshot({
      type: "png",
      omitBackground: true,
    });

    return new Uint8Array(png);
  } finally {
    await browser.close();
  }
}
