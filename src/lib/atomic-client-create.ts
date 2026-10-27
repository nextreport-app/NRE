import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "./prisma";
import { getSubscriptionStatus } from "./subscription";
import { ServiceError } from "./service-error";

/** Serialize create+count on the owner row, across every serverless instance and create/duplicate path. */
export async function createClientWithinCapacity(userId: string, data: Omit<Prisma.ClientUncheckedCreateInput, "userId">) {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.emailVerified) throw new ServiceError("Verify your email before adding clients.", 403);
    const status = getSubscriptionStatus(user);
    if (status.isBlocked) throw new ServiceError("Your trial or paid access has ended. Visit Billing to continue.", 403);
    const count = await tx.client.count({ where: { userId } });
    if (status.clientLimit !== null && count >= status.clientLimit) {
      throw new ServiceError(`Your plan allows ${status.clientLimit} active clients. Delete an unused client or visit Billing. For more than 50 clients, contact hello@nextreport.in.`, 403);
    }
    const client = await tx.client.create({ data: { ...data, userId } });
    await tx.user.update({ where: { id: userId }, data: { clientsCreatedCount: { increment: 1 } } });
    return client;
  });
}
