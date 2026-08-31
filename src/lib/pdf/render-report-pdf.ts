import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { appBaseUrl } from "./app-base-url";
import { signPdfRenderToken } from "./render-token";

async function resolveExecutablePath(): Promise<{ executablePath: string; args: string[] }> {
  if (process.env.NODE_ENV === "development") {
    const fromEnv = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();
    if (fromEnv) return { executablePath: fromEnv, args: ["--no-sandbox", "--disable-setuid-sandbox"] };
    for (const candidate of ["/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome"]) {
      try {
        const fs = await import("node:fs");
        if (fs.existsSync(candidate)) {
          return { executablePath: candidate, args: ["--no-sandbox", "--disable-setuid-sandbox"] };
        }
      } catch {
        /* continue */
      }
    }
  }

  return {
    executablePath: await chromium.executablePath(),
    args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox"],
  };
}

export function buildPrintReportUrl(shareToken: string): string {
  const sig = signPdfRenderToken(shareToken);
  return `${appBaseUrl()}/print/r/${encodeURIComponent(shareToken)}?sig=${sig}`;
}

/** Renders the published share-page layout to a landscape PDF buffer. */
export async function renderReportPdfFromShareToken(shareToken: string): Promise<Buffer> {
  const url = buildPrintReportUrl(shareToken);
  const { executablePath, args } = await resolveExecutablePath();

  const browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args,
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
    await page.goto(url, { waitUntil: "networkidle0", timeout: 120_000 });
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
