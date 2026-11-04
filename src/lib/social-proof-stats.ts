import "server-only";

import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

export type SocialProofStats = {
  totalReports: number;
  reportsLast7Days: number;
};

function socialProofUserEmail(): string | null {
  const raw = process.env.SOCIAL_PROOF_USER_EMAIL?.trim();
  return raw ? raw.toLowerCase() : null;
}

/** Counts completed reports for the configured production account (truthful live social proof). */
const cachedStats = unstable_cache(async (email: string): Promise<SocialProofStats | null> => {

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true },
  });
  if (!user) return null;

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [totalReports, reportsLast7Days] = await Promise.all([
    prisma.report.count({
      where: { status: "COMPLETE", client: { userId: user.id } },
    }),
    prisma.report.count({
      where: {
        status: "COMPLETE",
        client: { userId: user.id },
        createdAt: { gte: sevenDaysAgo },
      },
    }),
  ]);

  return { totalReports, reportsLast7Days };
}, ["public-social-proof-v1"], { revalidate: 60 });

export async function getSocialProofStats(): Promise<SocialProofStats | null> {
  const email = socialProofUserEmail();
  if (!email) return null;
  try { return await cachedStats(email); }
  catch { return null; } // Optional public proof must not take down the landing page.
}
