import fs from "node:fs";
import path from "node:path";
import puppeteer, { type Browser } from "puppeteer-core";
import chromium from "@sparticuz/chromium";

/** Launches headless Chromium for PDF/chart rasterization (Vercel + local dev). */
export async function launchPuppeteerBrowser(): Promise<Browser> {
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

  const binPath = path.join(process.cwd(), "node_modules/@sparticuz/chromium/bin");
  const executablePath = fs.existsSync(binPath)
    ? await chromium.executablePath(binPath)
    : await chromium.executablePath();

  return puppeteer.launch({
    headless: "shell",
    executablePath,
    args: puppeteer.defaultArgs({ args: chromium.args, headless: "shell" }),
    defaultViewport: { width: 1280, height: 720 },
  });
}
