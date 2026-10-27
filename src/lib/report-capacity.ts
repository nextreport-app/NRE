import { assertReportComplexity } from "./report-complexity";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "./prisma";
import { getSubscriptionStatus } from "./subscription";
import { ServiceError } from "./service-error";
import { GENERATION_LEASE_MS, GLOBAL_GENERATION_CONCURRENCY, TRIAL_REPORT_LIMIT, USER_GENERATION_CONCURRENCY } from "./launch-limits";

/** One short DB transaction reserves both a trial credit and shared execution capacity. */
export async function createReportWithinCapacity(userId: string, args: { data: Prisma.ReportUncheckedCreateInput }) {
  if (process.env.REPORT_GENERATION_PAUSED === "true") throw new ServiceError("Report generation is temporarily paused. Please try again later.", 503);
  if (typeof args.data.jobPayload === "string") {
    if (Buffer.byteLength(args.data.jobPayload) > 8 * 1024 * 1024) throw new ServiceError("Report payload exceeds 8 MB. Select fewer detail slides or a smaller date range.", 413);
    const payload = JSON.parse(args.data.jobPayload);
    if (payload.reportData) assertReportComplexity(payload.reportData);
  }
  return prisma.$transaction(async tx => {
    // Transaction-scoped global mutex; safe through transaction-mode poolers.
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(734013)`;
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.emailVerified) throw new ServiceError("Verify your email before generating reports.", 403);
    const status = getSubscriptionStatus(user);
    if (status.isBlocked) throw new ServiceError("Your trial or paid access has ended. Visit Billing to continue.", 403);
    const client = await tx.client.findFirst({ where: { id: args.data.clientId, userId }, select: { id: true } });
    if (!client) throw new ServiceError("Client not found.", 404);
    const cutoff = new Date(Date.now() - GENERATION_LEASE_MS);
    const recent = { status: "GENERATING" as const, OR: [{ createdAt: { gt: cutoff } }, { processingStartedAt: { gt: cutoff } }] };
    const own = await tx.report.count({ where: { ...recent, client: { userId } } });
    const total = await tx.report.count({ where: recent });
    if (own >= USER_GENERATION_CONCURRENCY || total >= GLOBAL_GENERATION_CONCURRENCY) {
      throw new ServiceError("Report generation is busy. Wait for the current report to finish, then try again.", 429, 30);
    }
    const reserveTrial = status.isTrialing && !status.isAdminOverride;
    if (reserveTrial && user.trialReportsUsed >= TRIAL_REPORT_LIMIT) throw new ServiceError("You have used your 10 trial reports. Subscribe to generate more.", 403);
    if (reserveTrial) await tx.user.update({ where: { id: userId }, data: { trialReportsUsed: { increment: 1 } } });
    return tx.report.create({ data: { ...args.data, trialCreditReserved: reserveTrial, ...(args.data.reportType === "WEBSITE" ? { processingStartedAt: new Date() } : {}) } });
  });
}

/** Failure refunds a reserved trial credit exactly once, even when retry paths race. */
export async function failReportGeneration(reportId: string, message: string) {
  return prisma.$transaction(async tx => {
    const report = await tx.report.findUnique({ where: { id: reportId }, include: { client: { select: { userId: true } } } });
    if (!report || report.status === "COMPLETE") return;
    const refunded = await tx.report.updateMany({ where: { id: reportId, trialCreditReserved: true, status: { not: "COMPLETE" } }, data: { trialCreditReserved: false } });
    if (refunded.count) await tx.user.updateMany({ where: { id: report.client.userId, trialReportsUsed: { gt: 0 } }, data: { trialReportsUsed: { decrement: 1 } } });
    await tx.report.update({ where: { id: reportId }, data: { status: "FAILED", errorMessage: message, jobPayload: null } });
  });
}

/** Atomic claim prevents duplicate worker dispatches/fallbacks from rendering the same report. */
export async function claimReportGeneration(reportId: string): Promise<boolean> {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(734013)`;
    const cutoff = new Date(Date.now() - GENERATION_LEASE_MS);
    const target = await tx.report.findUnique({ where: { id: reportId }, include: { client: { select: { userId: true } } } });
    if (!target) return false;
    const ownRunning = await tx.report.count({ where: { status: "GENERATING", processingStartedAt: { gt: cutoff }, client: { userId: target.client.userId } } });
    if (ownRunning >= USER_GENERATION_CONCURRENCY) return false;
    const running = await tx.report.count({ where: { status: "GENERATING", processingStartedAt: { gt: cutoff } } });
    if (running >= GLOBAL_GENERATION_CONCURRENCY) return false;
    const claimed = await tx.report.updateMany({
      where: { id: reportId, status: "GENERATING", OR: [{ processingStartedAt: null }, { processingStartedAt: { lt: cutoff } }] },
      data: { processingStartedAt: new Date() },
    });
    return claimed.count === 1;
  });
}
