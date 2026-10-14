import "server-only";

import { prisma } from "@/lib/prisma";
import { normalizeAuthEmail } from "@/lib/normalize-auth-email";

type UserFindSelect = NonNullable<Parameters<typeof prisma.user.findUnique>[0]>["select"];

/** Lookup by normalized email, with case-insensitive fallback for legacy rows. */
export async function findUserByEmail<S extends UserFindSelect>(
  emailRaw: string,
  select: S,
) {
  const email = normalizeAuthEmail(emailRaw);
  if (!email) return null;

  const direct = await prisma.user.findUnique({ where: { email }, select });
  if (direct) return direct;

  return prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select,
  });
}
