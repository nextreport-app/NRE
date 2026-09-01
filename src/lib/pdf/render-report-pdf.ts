import type { Browser } from "puppeteer-core";
import type { ShareReportData } from "@/lib/nre/share-report";
import { launchPuppeteerBrowser } from "./puppeteer-browser";

// Prebuilt by scripts/build-pdf-html-bundle.mjs — keeps react-dom/server out of the Next.js graph.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { buildPrintReportHtml } = require("./print-report-html.bundle.cjs") as {
  buildPrintReportHtml: (share: ShareReportData) => string;
};

/** Renders published share data to a landscape PDF buffer (no live URL fetch). */
export async function renderReportPdfFromShareData(share: ShareReportData): Promise<Buffer> {
  const html = buildPrintReportHtml(share);
  const browser = await launchPuppeteerBrowser();

  try {
    return await renderPdfInBrowser(browser, html);
  } finally {
    await browser.close();
  }
}

async function renderPdfInBrowser(browser: Browser, html: string): Promise<Buffer> {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForSelector("#share-report-print", { timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready).catch(() => undefined);
  await page.emulateMediaType("print");

  const pdf = await page.pdf({
    format: "A4",
    landscape: true,
    printBackground: true,
    preferCSSPageSize: false,
    margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" },
  });

  return Buffer.from(pdf);
}
