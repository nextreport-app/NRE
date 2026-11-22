import { prisma } from "../prisma";
import { ServiceError } from "../service-error";
import { queueBlobDeletions } from "../blob-deletion-outbox";
export async function approveAgencyTemplate(
  id: string,
  userId: string,
  digest: string,
) {
  const result = await prisma.agencyTemplate.updateMany({
    where: { id, userId, status: "READY", digest, archivedAt: null },
    data: { approvedAt: new Date() },
  });
  if (!result.count)
    throw new ServiceError(
      "This template changed or is no longer available. Review its sample again.",
      409,
    );
}
export async function selectClientDesign(
  clientId: string,
  userId: string,
  selection: { agencyTemplateId: string | null; variant?: "DARK" | "LIGHT" },
) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(734013)`;
    const client = await tx.client.findFirst({
      where: { id: clientId, userId },
    });
    if (!client) throw new ServiceError("Not found", 404);
    if (selection.agencyTemplateId) {
      const asset = await tx.agencyTemplate.findFirst({
        where: {
          id: selection.agencyTemplateId,
          userId,
          status: "READY",
          archivedAt: null,
          approvedAt: { not: null },
        },
      });
      if (!asset)
        throw new ServiceError("Choose an approved, active agency design.");
      return tx.client.update({
        where: { id: clientId },
        data: { agencyTemplateId: asset.id, template: asset.baseVariant },
      });
    }
    return tx.client.update({
      where: { id: clientId },
      data: {
        agencyTemplateId: null,
        template: selection.variant ?? client.template,
      },
    });
  });
}
export async function removeAgencyTemplate(id: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(734013)`;
    const asset = await tx.agencyTemplate.findFirst({ where: { id, userId } });
    if (!asset) throw new ServiceError("Not found", 404);
    if (
      asset.status === "UPLOADING" &&
      Date.now() - asset.createdAt.getTime() < 15 * 60000
    )
      throw new ServiceError(
        "Wait for this upload to finish before removing it.",
        409,
      );
    await tx.client.updateMany({
      where: { userId, agencyTemplateId: id },
      data: { agencyTemplateId: null },
    });
    if (await tx.report.count({ where: { agencyTemplateId: id } })) {
      await tx.agencyTemplate.update({
        where: { id },
        data: { archivedAt: new Date() },
      });
      return { archived: true };
    }
    await tx.agencyTemplate.delete({ where: { id } });
    await queueBlobDeletions(tx, [asset.filePath, asset.previewPath]);
    return { archived: false };
  });
}
