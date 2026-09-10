import { prisma } from "@/lib/prisma";

/** Increment lifetime client slots after a successful Client.create. */
export async function recordClientCreated(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { clientsCreatedCount: { increment: 1 } },
  });
}

/** Active clients + lifetime slots for Agency cap checks. */
export async function getClientCapacityUsage(userId: string): Promise<{
  activeClientCount: number;
  clientsCreatedCount: number;
}> {
  const [activeClientCount, user] = await Promise.all([
    prisma.client.count({ where: { userId } }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { clientsCreatedCount: true },
    }),
  ]);
  return {
    activeClientCount,
    clientsCreatedCount: user?.clientsCreatedCount ?? activeClientCount,
  };
}
