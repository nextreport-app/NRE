import { NextResponse } from "next/server";
import { purgeExpiredReports } from "@/lib/report-retention";
import { retryStuckReportGenerations } from "@/lib/nre/retry-stuck-report-generations";
import { purgeAllEphemeralWizardBlobs, purgeStaleWizardBlobs } from "@/lib/wizard-storage-cleanup";

/** Daily cron — report retention, stuck-job retry, and stale wizard blob cleanup. Requires CRON_SECRET bearer token. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const wizardPurge = url.searchParams.get("wizardPurge");

  const [deleted, retriedStuck, wizardBlobs] = await Promise.all([
    purgeExpiredReports(),
    retryStuckReportGenerations(),
    wizardPurge === "all"
      ? purgeAllEphemeralWizardBlobs()
      : purgeStaleWizardBlobs(),
  ]);
  return NextResponse.json({
    ok: true,
    deleted,
    retriedStuck,
    wizardBlobs,
    wizardPurge: wizardPurge === "all" ? "all" : "stale",
  });
}
