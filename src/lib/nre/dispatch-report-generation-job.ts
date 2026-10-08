/**
 * Enqueue async report generation — production uses an internal HTTP worker;
 * local dev without CRON_SECRET runs inline.
 *
 * On Vercel, an un-awaited fetch is not guaranteed to run once the route
 * returns — scheduleReportGenerationJob uses Next.js after() so the worker
 * request is kept alive until it is dispatched.
 *
 * This module must not statically import PPTX render code (Function Storage).
 */

import { after } from "next/server";

const WORKER_FETCH_TIMEOUT_MS = 90_000;

function internalBaseUrl(): string {
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return vercel.startsWith("http") ? vercel : `https://${vercel}`;
  const authUrl = process.env.NEXTAUTH_URL?.trim();
  if (authUrl) return authUrl.replace(/\/$/, "");
  return "http://localhost:3000";
}

async function inlineProcessReportGeneration(reportId: string): Promise<void> {
  const { processReportGeneration } = await import("@/lib/nre/report-generation-job");
  await processReportGeneration(reportId);
}

async function invokeReportGenerationWorker(reportId: string): Promise<void> {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    await inlineProcessReportGeneration(reportId);
    return;
  }

  const url = `${internalBaseUrl()}/api/jobs/generate-report`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WORKER_FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reportId }),
      signal: controller.signal,
    });
  } catch (err) {
    console.error("[report-generation] worker fetch failed:", err);
    await inlineProcessReportGeneration(reportId);
    return;
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[report-generation] worker HTTP", res.status, body);
    await inlineProcessReportGeneration(reportId);
  }
}

async function runReportGenerationWithFallback(reportId: string): Promise<void> {
  try {
    await invokeReportGenerationWorker(reportId);
  } catch (err) {
    console.error("[scheduleReportGenerationJob] failed:", err);
    await inlineProcessReportGeneration(reportId);
  }
}

/** Schedule generation after the wizard POST responds — use from route handlers. */
export function scheduleReportGenerationJob(reportId: string): void {
  after(async () => {
    try {
      await runReportGenerationWithFallback(reportId);
    } catch (err) {
      console.error("[scheduleReportGenerationJob] failed:", err);
    }
  });
}

/** Await completion — cron retries and other callers that can block. */
export async function dispatchReportGenerationJob(reportId: string): Promise<void> {
  await invokeReportGenerationWorker(reportId);
}
