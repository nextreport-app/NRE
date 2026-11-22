import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";
import { prisma } from "../prisma";
import { ServiceError } from "../service-error";
import { getSubscriptionStatus } from "../subscription";
import { queueBlobDeletions } from "../blob-deletion-outbox";
import { validateAgencyTemplate } from "./validate";
import { renderAgencyTemplatePreview } from "./preview";
export async function uploadAgencyTemplate(
  userId: string,
  name: string,
  variant: "DARK" | "LIGHT",
  buffer: Buffer,
) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.emailVerified || getSubscriptionStatus(user).isBlocked)
    throw new ServiceError(
      "An active account with a verified email is required.",
      403,
    );
  const { digest, buffer: validated } = await validateAgencyTemplate(
    buffer,
    variant,
  );
  const id = randomUUID(),
    filePath = `agency-templates/${userId}/${id}.pptx`,
    previewPath = `agency-templates/${userId}/${id}-preview.pptx`;
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(734013)`;
    if ((await tx.agencyTemplate.count({ where: { userId } })) >= 10)
      throw new ServiceError(
        "You can save up to 10 designs, including archived versions still used by reports. Remove an unused design first.",
        409,
      );
    await tx.agencyTemplate.create({
      data: {
        id,
        userId,
        name,
        baseVariant: variant,
        filePath,
        previewPath,
        digest,
      },
    });
  });
  try {
    const preview = await renderAgencyTemplatePreview(validated, variant);
    const stored = await Promise.allSettled([
      put(filePath, validated, {
        access: "private",
        addRandomSuffix: false,
        contentType:
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      }),
      put(previewPath, preview, {
        access: "private",
        addRandomSuffix: false,
        contentType:
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      }),
    ]);
    if (stored[0].status !== "fulfilled" || stored[1].status !== "fulfilled")
      throw new ServiceError(
        "The design could not be saved. Retry the upload.",
        502,
      );
    const [file, sample] = [stored[0].value, stored[1].value];
    await prisma.agencyTemplate.update({
      where: { id },
      data: { filePath: file.url, previewPath: sample.url, status: "READY" },
    });
    return id;
  } catch (error) {
    await prisma.$transaction(async (tx) => {
      await queueBlobDeletions(tx, [filePath, previewPath]);
      await tx.agencyTemplate.deleteMany({
        where: { id, userId, status: "UPLOADING" },
      });
    });
    throw error;
  }
}
