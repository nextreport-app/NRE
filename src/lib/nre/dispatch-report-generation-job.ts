/**
 * Enqueue async report generation — production uses an internal HTTP worker;
 * local dev without CRON_SECRET runs inline.
 *
 * On Vercel, an un-awaited fetch is not guaranteed to run once the route
 * returns — scheduleReportGenerationJob uses Next.js after() so the worker
 * request is kept alive until it is dispatched.
 */

import { after } from "next/server";
import { processReportGeneration } from "@/lib/nre/report-generation-job";

function internalBaseUrl(): string {
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return vercel.startsWith("http") ? vercel : `https://${vercel}`;
  const authUrl = process.env.NEXTAUTH_URL?.trim();
  if (authUrl) return authUrl.replace(/\/$/, "");
  return "http://localhost:3000";
}

async function invokeReportGenerationWorker(reportId: string): Promise<void> {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    await processReportGeneration(reportId);
    return;
  }

  const url = `${internalBaseUrl()}/api/jobs/generate-report`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ reportId }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[report-generation] worker HTTP", res.status, body);
    // Fallback so a misconfigured worker does not leave reports stuck in GENERATING.
    await processReportGeneration(reportId);
  }
}

/** Schedule generation after the wizard POST responds — use from route handlers. */
export function scheduleReportGenerationJob(reportId: string): void {
  after(async () => {
    try {
      await invokeReportGenerationWorker(reportId);
    } catch (err) {
      console.error("[scheduleReportGenerationJob] failed:", err);
      try {
        await processReportGeneration(reportId);
      } catch (fallbackErr) {
        console.error("[scheduleReportGenerationJob] inline fallback failed:", fallbackErr);
      }
    }
  });
}

/** Await completion — cron retries and other callers that can block. */
export async function dispatchReportGenerationJob(reportId: string): Promise<void> {
  await invokeReportGenerationWorker(reportId);
}
