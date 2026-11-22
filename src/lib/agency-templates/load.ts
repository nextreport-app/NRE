import { createHash } from "node:crypto";
import { prisma } from "../prisma";
import { readReportFile } from "../storage";
import { loadTemplateBufferForPlatform } from "../pptx/templates";
import { ServiceError } from "../service-error";
import type { ReportTemplate } from "@/generated/prisma/enums";
/** A report keeps its immutable uploaded asset even after the client selects another design. */
export async function loadReportTemplate(
  platform: "META" | "GOOGLE" | "GA4" | "TIKTOK",
  variant: ReportTemplate,
  userId: string,
  agencyTemplateId?: string | null,
) {
  if (!agencyTemplateId)
    return loadTemplateBufferForPlatform(platform, variant);
  if (platform !== "META")
    throw new ServiceError(
      "Agency PowerPoint designs are available for Meta reports only.",
    );
  const asset = await prisma.agencyTemplate.findFirst({
    where: {
      id: agencyTemplateId,
      userId,
      status: "READY",
      approvedAt: { not: null },
    },
  });
  if (!asset)
    throw new ServiceError(
      "The saved agency design is unavailable. Choose a supported design before generating a new report.",
      409,
    );
  const bytes = await readReportFile(asset.filePath);
  if (createHash("sha256").update(bytes).digest("hex") !== asset.digest)
    throw new ServiceError(
      "The saved agency design failed its integrity check. Upload a new version.",
      409,
    );
  return bytes;
}
