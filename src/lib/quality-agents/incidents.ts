import { prisma } from "@/lib/prisma";
import type { CsvVerificationResult } from "@/lib/nre/csv-report-reconciliation";
import { incidentFingerprint, mismatchSignals, safePlatform, safeReportType, SIGNAL_CODES, type IncidentKind } from "./incident-policy";

type Context = { userId: string; contextKey: string; platform: string; reportType: string };
export async function recordQualityIncident(input: Context & { kind: IncidentKind; signalCodes: string[] }): Promise<string | null> {
  if (process.env.REPORT_QUALITY_CAPTURE_ENABLED === "false" || !input.signalCodes.length) return null;
  const signalCodes = [...new Set(input.signalCodes.filter(code => (SIGNAL_CODES as readonly string[]).includes(code)))].sort();
  if (!signalCodes.length) return null;
  const fingerprint = incidentFingerprint({ ...input, signalCodes });
  try {
    const revision = process.env.VERCEL_GIT_COMMIT_SHA;
    const record = await prisma.reportQualityIncident.upsert({
      where: { fingerprint },
      create: {
        fingerprint, userId: input.userId, kind: input.kind,
        platform: safePlatform(input.platform), reportType: safeReportType(input.reportType), signalCodes,
        revision: revision && /^[a-f\d]{7,40}$/i.test(revision) ? revision : null,
      },
      update: { occurrences: { increment: 1 }, lastSeenAt: new Date() },
      select: { id: true },
    });
    return record.id;
  } catch {
    // Monitoring must never turn a usable report or support request into a failure.
    console.error("[quality-guardian] Could not persist incident metadata");
    return null;
  }
}
export async function captureCsvQualityIncident(context: Context, verification: CsvVerificationResult): Promise<void> {
  const signals = mismatchSignals(verification);
  if (!signals.length) return;
  const id = await recordQualityIncident({ ...context, kind: "CSV_MISMATCH", signalCodes: signals });
  if (id) verification.qualityIncidentId = id;
}
