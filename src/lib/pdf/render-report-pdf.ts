import puppeteer, { type Browser } from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import type { ShareReportData } from "@/lib/nre/share-report";
import { buildPrintReportHtml } from "./print-report-html";

async function launchBrowser(): Promise<Browser> {
  const isDev = process.env.NODE_ENV === "development";

  if (isDev) {
    const fromEnv = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();
    const candidates = [
      fromEnv,
      "/usr/local/bin/google-chrome",
      "/usr/bin/google-chrome",
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
    ].filter(Boolean) as string[];

    for (const executablePath of candidates) {
      try {
        const fs = await import("node:fs");
        if (!fs.existsSync(executablePath)) continue;
        return puppeteer.launch({
          headless: true,
          executablePath,
          args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
        });
      } catch {
        /* try next */
      }
    }
  }

  chromium.setGraphicsMode = false;

  return puppeteer.launch({
    headless: true,
    executablePath: await chromium.executablePath(),
    args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    defaultViewport: { width: 1280, height: 720 },
  });
}

/** Renders published share data to a landscape PDF buffer (no live URL fetch). */
export async function renderReportPdfFromShareData(share: ShareReportData): Promise<Buffer> {
  const html = buildPrintReportHtml(share);
  const browser = await launchBrowser();

  try {
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
  } finally {
    await browser.close();
  }
}

/** @deprecated Prefer renderReportPdfFromShareData — avoids brittle self-HTTP on serverless. */
export async function renderReportPdfFromShareToken(_shareToken: string): Promise<Buffer> {
  throw new Error("renderReportPdfFromShareToken requires share data — use renderReportPdfFromShareData");
}
