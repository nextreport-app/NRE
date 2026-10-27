import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "./prisma";
import { getSubscriptionStatus } from "./subscription";
export async function recordGenerationOutcome(tx: Prisma.TransactionClient, reportId: string, outcome: "COMPLETE" | "FAILED", occurredAt = new Date()) {
  const report = await tx.report.findUniqueOrThrow({ where: { id: reportId }, include: { client: { include: { user: { select: { email: true, planId: true, trialEndsAt: true, paidThrough: true, emailVerified: true } } } } } });
  const status = getSubscriptionStatus(report.client.user);
  await tx.reportGenerationEvent.upsert({ where: { reportId_outcome: { reportId, outcome } }, create: {
    id: `${reportId}:${outcome}`, reportId, userId: report.client.userId, clientId: report.clientId,
    platform: report.platform, reportType: report.reportType, planId: status.isAdminOverride ? "admin" : status.planId, outcome, occurredAt,
  }, update: {} });
}
/** The report and its completion receipt commit together; edits/deletions cannot change daily counts. */
export async function completeReportGeneration(args: { where: { id: string }; data: Prisma.ReportUpdateInput }) {
  return prisma.$transaction(async tx => {
    const previous = await tx.report.findUniqueOrThrow({ where: args.where });
    if (previous.status === "COMPLETE") return previous;
    const now = new Date();
    const report = await tx.report.update({ where: args.where, data: { ...args.data, status: "COMPLETE", completedAt: now } });
    await recordGenerationOutcome(tx, report.id, "COMPLETE", now);
    return report;
  });
}
