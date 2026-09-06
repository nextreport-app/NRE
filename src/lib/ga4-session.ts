/**
 * Resolves a fresh GA4 access token for the signed-in user — refreshes when needed.
 */

import { prisma } from "@/lib/prisma";
import { refreshGa4AccessToken } from "@/lib/ga4-api";

export async function getGa4AccessTokenForUser(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { ga4RefreshToken: true, ga4AccessToken: true },
  });

  if (!user?.ga4RefreshToken) return null;

  try {
    const refreshed = await refreshGa4AccessToken(user.ga4RefreshToken);
    await prisma.user.update({
      where: { id: userId },
      data: { ga4AccessToken: refreshed.access_token },
    });
    return refreshed.access_token;
  } catch {
    return user.ga4AccessToken ?? null;
  }
}
