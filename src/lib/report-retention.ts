import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { deleteReportFile } from "@/lib/storage";
import type { PlanId } from "@/lib/subscription";

/** Default and legacy constant — existing imports keep working. */
export const DEFAULT_REPORT_RETENTION_DAYS = 30;
export const REPORT_RETENTION_DAYS = DEFAULT_REPORT_RETENTION_DAYS;

/** Selectable retention windows (days). Professional plans may use the full list. */
export const REPORT_RETENTION_DAY_OPTIONS = [7, 14, 30, 60, 90] as const;
export type ReportRetentionDaysOption = (typeof REPORT_RETENTION_DAY_OPTIONS)[number];

const BATCH_SIZE = 50;

/** Starter/trial accounts cap at 30 days; Professional may keep reports up to 90 days. */
export function maxReportRetentionDaysForPlan(planId: PlanId): number {
  return planId === "professional" ? 90 : 30;
}

export function allowedReportRetentionOptions(planId: PlanId): ReportRetentionDaysOption[] {
  const max = maxReportRetentionDaysForPlan(planId);
  return REPORT_RETENTION_DAY_OPTIONS.filter((days) => days <= max);
}

/** Validates a requested retention value for the user's plan — falls back to default when invalid. */
export function normalizeReportRetentionDays(
  value: number | null | undefined,
  planId: PlanId,
): ReportRetentionDaysOption {
  const allowed = allowedReportRetentionOptions(planId);
  if (value != null && allowed.includes(value as ReportRetentionDaysOption)) {
    return value as ReportRetentionDaysOption;
  }
  const cappedDefault = Math.min(DEFAULT_REPORT_RETENTION_DAYS, maxReportRetentionDaysForPlan(planId));
  return allowed.includes(cappedDefault as ReportRetentionDaysOption)
    ? (cappedDefault as ReportRetentionDaysOption)
    : allowed[allowed.length - 1]!;
}

function cutoffBeforeDays(now: Date, days: number): Date {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days);
  return cutoff;
}

async function purgeReportBatch(where: Prisma.ReportWhereInput): Promise<number> {
  let total = 0;

  for (;;) {
    const batch = await prisma.report.findMany({
      where,
      select: { id: true, filePath: true, pdfPath: true },
      take: BATCH_SIZE,
    });
    if (batch.length === 0) break;

    await Promise.all(
      batch.map(async (report) => {
        if (report.filePath) await deleteReportFile(report.filePath).catch(() => undefined);
        if (report.pdfPath) await deleteReportFile(report.pdfPath).catch(() => undefined);
      }),
    );
    await prisma.report.deleteMany({ where: { id: { in: batch.map((r) => r.id) } } });
    total += batch.length;
    if (batch.length < BATCH_SIZE) break;
  }

  return total;
}

async function purgeReportsOlderThan(days: number, now: Date): Promise<number> {
  const cutoff = cutoffBeforeDays(now, days);
  return purgeReportBatch({
    createdAt: { lt: cutoff },
    client: { user: { reportRetentionDays: days } },
  });
}

/**
 * Deletes expired reports for one account owner — used on client page visits so
 * purging respects the user's configured window without scanning all tenants.
 */
export async function purgeExpiredReportsForUser(userId: string, now = new Date()): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { reportRetentionDays: true },
  });
  if (!user) return 0;

  const days = user.reportRetentionDays ?? DEFAULT_REPORT_RETENTION_DAYS;
  const cutoff = cutoffBeforeDays(now, days);
  return purgeReportBatch({
    createdAt: { lt: cutoff },
    client: { userId },
  });
}

/**
 * Deletes reports past each user's configured retention window — blobs first, then DB rows.
 * Returns total reports removed across all batches and retention settings.
 */
export async function purgeExpiredReports(now = new Date()): Promise<number> {
  const distinctSettings = await prisma.user.findMany({
    select: { reportRetentionDays: true },
    distinct: ["reportRetentionDays"],
  });

  const retentionDays = distinctSettings.map((row) => row.reportRetentionDays ?? DEFAULT_REPORT_RETENTION_DAYS);
  const uniqueDays = [...new Set(retentionDays)];

  let total = 0;
  for (const days of uniqueDays) {
    total += await purgeReportsOlderThan(days, now);
  }
  return total;
}
