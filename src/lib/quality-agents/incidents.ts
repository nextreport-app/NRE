import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { CsvVerificationResult } from "@/lib/nre/csv-report-reconciliation";
import { incidentFingerprint, mismatchSignals, safePlatform, safeReportType, SIGNAL_CODES, type IncidentKind } from "./incident-policy";

type Context = { userId: string; contextKey: string; platform: string; reportType: string; clientId?: string; diagnostics?: { profile: unknown; checks: unknown }; recheckIncidentId?: string };
export async function recordQualityIncident(input: Context & { kind: IncidentKind; signalCodes: string[] }): Promise<string | null> {
  if (process.env.REPORT_QUALITY_CAPTURE_ENABLED === "false" || !input.signalCodes.length) return null;
  const signalCodes = [...new Set(input.signalCodes.filter(code => (SIGNAL_CODES as readonly string[]).includes(code)))].sort();
  if (!signalCodes.length) return null;
  const revision = process.env.VERCEL_GIT_COMMIT_SHA;
  const fingerprint = incidentFingerprint({ ...input, contextKey: `${input.contextKey}:${revision ?? "local"}`, signalCodes });
  try {
    const record = await prisma.reportQualityIncident.upsert({
      where: { fingerprint },
      create: {
        fingerprint, userId: input.userId, kind: input.kind,
        clientId: input.clientId,
        contextHash: createHash("sha256").update(input.contextKey).digest("hex"),
        diagnosticsJson: input.diagnostics ? JSON.stringify(input.diagnostics) : undefined,
        state: input.diagnostics && input.clientId ? "QUEUED" : "RECORDED",
        platform: safePlatform(input.platform), reportType: safeReportType(input.reportType), signalCodes,
        revision: revision && /^[a-f\d]{7,40}$/i.test(revision) ? revision : null,
      },
      update: { occurrences: { increment: 1 }, lastSeenAt: new Date(), ...(input.diagnostics ? { diagnosticsJson: JSON.stringify(input.diagnostics) } : {}) },
      select: { id: true },
    });
    if (input.kind === "CSV_MISMATCH") await prisma.reportQualityIncident.updateMany({where:{id:record.id,state:"VERIFIED"},data:{state:"NEEDS_REVIEW",stateUpdatedAt:new Date(),resolvedAt:null}});
    return record.id;
  } catch {
    // Monitoring must never turn a usable report or support request into a failure.
    console.error("[quality-guardian] Could not persist incident metadata");
    return null;
  }
}
export async function captureCsvQualityIncident(context: Context, verification: CsvVerificationResult): Promise<void> {
  if (context.clientId && verification.status === "ok" && verification.checks.length > 0 && verification.checks.every(check=>check.status==="ok")) {
    try {
      const result=await prisma.reportQualityIncident.updateMany({where:{...(context.recheckIncidentId?{id:context.recheckIncidentId}:{}),userId:context.userId,clientId:context.clientId,contextHash:createHash("sha256").update(context.contextKey).digest("hex"),state:{not:"VERIFIED"}},data:{state:"VERIFIED",stateUpdatedAt:new Date(),resolvedAt:new Date()}});
      if(result.count) {
        if(context.recheckIncidentId) verification.qualityIncidentId=context.recheckIncidentId;
        else {const verified=await prisma.reportQualityIncident.findFirst({where:{userId:context.userId,clientId:context.clientId,contextHash:createHash("sha256").update(context.contextKey).digest("hex"),state:"VERIFIED"},orderBy:{createdAt:"desc"},select:{id:true}});if(verified)verification.qualityIncidentId=verified.id;}
      }
    }catch{console.error("[quality-guardian] Could not save recheck outcome");}
  }
  if (context.recheckIncidentId && context.clientId && verification.status === "mismatch") {
    try {await prisma.reportQualityIncident.updateMany({where:{id:context.recheckIncidentId,userId:context.userId,clientId:context.clientId,contextHash:createHash("sha256").update(context.contextKey).digest("hex"),state:"READY_TO_RECHECK"},data:{state:"NEEDS_REVIEW",stateUpdatedAt:new Date()}});}catch{console.error("[quality-guardian] Could not save persistent discrepancy");}
  }
  const signals = mismatchSignals(verification);
  if (!signals.length) return;
  const id = await recordQualityIncident({ ...context, kind: "CSV_MISMATCH", signalCodes: signals });
  if (id) verification.qualityIncidentId = id;
}
