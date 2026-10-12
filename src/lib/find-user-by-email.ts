import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeAuthEmail } from "@/lib/normalize-auth-email";

/** Lookup by normalized email, with case-insensitive fallback for legacy rows. */
export async function findUserByEmail<T extends Prisma.UserSelect>(
  emailRaw: string,
  select: T,
): Promise<Prisma.UserGetPayload<{ select: T }> | null> {
  const email = normalizeAuthEmail(emailRaw);
  if (!email) return null;

  const direct = await prisma.user.findUnique({ where: { email }, select });
  if (direct) return direct;

  return prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select,
  });
}
