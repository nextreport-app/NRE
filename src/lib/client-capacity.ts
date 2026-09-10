import { prisma } from "@/lib/prisma";

/** Analytics counter — incremented on every Client.create; not used for plan enforcement. */
export async function recordClientCreated(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { clientsCreatedCount: { increment: 1 } },
  });
}

/** Active client rows for Agency cap checks (concurrent limit, not lifetime). */
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
    clientsCreatedCount: user?.clientsCreatedCount ?? 0,
  };
}
