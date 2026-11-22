import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "../prisma";
import { ServiceError } from "../service-error";
import { queueBlobDeletions } from "../blob-deletion-outbox";
/** Serializes edits with approval/send. A new scheduled revision never overwrites approved PPTX bytes in place. */
export async function updateReviewReport(
  report: { id: string; requiresApproval?: boolean },
  data: Prisma.ReportUpdateInput,
) {
  if (!report.requiresApproval)
    return prisma.report.update({ where: { id: report.id }, data });
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(734020)`;
      const current = await tx.report.findUnique({
        where: { id: report.id },
        include: { scheduleRun: true },
      });
      if (!current) throw new ServiceError("Report not found", 404);
      if (["SENDING", "REVIEW"].includes(current.scheduleRun?.status ?? ""))
        throw new ServiceError(
          "Delivery is in progress or needs review. Wait before editing this report.",
          409,
        );
      const unpublished = current.scheduleRun?.status !== "SENT";
      const updated = await tx.report.update({
        where: { id: report.id },
        data: { ...data, ...(unpublished ? { approvedAt: null } : {}) },
      });
      if (
        unpublished &&
        current.scheduleRun &&
        current.scheduleRun.status === "APPROVED"
      )
        await tx.scheduledReportRun.update({
          where: { id: current.scheduleRun.id },
          data: { status: "READY", approvalDigest: null, approvedAt: null },
        });
      if (
        typeof data.filePath === "string" &&
        current.filePath &&
        current.filePath !== data.filePath
      )
        await queueBlobDeletions(tx, [current.filePath]);
      return updated;
    });
  } catch (error) {
    if (typeof data.filePath === "string")
      await queueBlobDeletions(prisma, [data.filePath]).catch(() => {});
    throw error;
  }
}
