import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Disconnects TikTok Ads from the signed-in user's account. */
export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      tiktokAdsEnabled: false,
      tiktokAccessToken: null,
      tiktokRefreshToken: null,
      tiktokTokenExpiresAt: null,
      tiktokConnectedName: null,
      tiktokAdvertiserIds: null,
    },
  });

  return NextResponse.json({ ok: true });
}
