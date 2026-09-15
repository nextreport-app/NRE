/**
 * Enqueue async report generation — production uses an internal HTTP worker;
 * local dev without CRON_SECRET runs inline.
 */

import { processReportGeneration } from "@/lib/nre/report-generation-job";

function internalBaseUrl(): string {
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return vercel.startsWith("http") ? vercel : `https://${vercel}`;
  const authUrl = process.env.NEXTAUTH_URL?.trim();
  if (authUrl) return authUrl.replace(/\/$/, "");
  return "http://localhost:3000";
}

/** Fire-and-forget in production; await inline when no worker secret is configured. */
export async function dispatchReportGenerationJob(reportId: string): Promise<void> {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    await processReportGeneration(reportId);
    return;
  }

  const url = `${internalBaseUrl()}/api/jobs/generate-report`;
  void fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ reportId }),
  }).catch((err) => {
    console.error("[dispatchReportGenerationJob] worker fetch failed:", err);
  });
}
