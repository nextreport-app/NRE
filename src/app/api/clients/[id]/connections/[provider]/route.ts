import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { providerKeys } from "@/lib/client-provider-connections";
import { apiErrorResponse } from "@/lib/api-error";
import { ServiceError } from "@/lib/service-error";
/** Explicitly remove only this client's override; never revoke shared provider grants. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; provider: string }> },
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id, provider } = await params;
    if (!providerKeys.includes(provider as (typeof providerKeys)[number]))
      throw new ServiceError("Not found", 404);
    await prisma.$transaction(async (tx) => {
      const client = await tx.client.findUnique({
        where: { id },
        select: { userId: true },
      });
      if (!client || client.userId !== session.user.id)
        throw new ServiceError("Not found", 404);
      await tx.clientProviderConnection.deleteMany({
        where: { clientId: id, provider },
      });
      if (provider === "gsc") {
        await tx.client.update({where: {id}, data: {gscSiteUrl: null}});
        await tx.searchConsoleSnapshot.deleteMany({where: {clientId: id}});
      }
      if (provider === "ga4") {
        await tx.client.update({
          where: { id },
          data: { ga4PropertyId: null, ga4PropertyName: null },
        });
        await tx.websiteDashboardSnapshot.deleteMany({
          where: { clientId: id },
        });
      }
      if (provider === "meta")
        await tx.client.update({
          where: { id },
          data: { metaAdAccountId: null, metaAdAccountName: null },
        });
      if (provider === "google-drive")
        await tx.client.update({
          where: { id },
          data: { lastDriveFolderId: null, lastDriveFolderName: null },
        });
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiErrorResponse(e, "client:connections");
  }
}
