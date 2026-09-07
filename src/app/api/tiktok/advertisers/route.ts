import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureFreshTikTokAccessToken, fetchTikTokAdvertisers } from "@/lib/tiktok-api";

/** Lists TikTok advertiser accounts the connected user can access. */
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      tiktokAdsEnabled: true,
      tiktokAccessToken: true,
      tiktokRefreshToken: true,
      tiktokTokenExpiresAt: true,
      tiktokAdvertiserIds: true,
    },
  });

  if (!user?.tiktokAdsEnabled || !user.tiktokAccessToken) {
    return NextResponse.json({ error: "TikTok Ads is not connected" }, { status: 400 });
  }

  try {
    const fresh = await ensureFreshTikTokAccessToken({
      accessToken: user.tiktokAccessToken,
      refreshToken: user.tiktokRefreshToken,
      tokenExpiresAt: user.tiktokTokenExpiresAt,
    });

    if (fresh.refreshed) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          tiktokAccessToken: fresh.accessToken,
          tiktokRefreshToken: fresh.refreshToken,
          tiktokTokenExpiresAt: fresh.tokenExpiresAt,
        },
      });
    }

    const advertisers = await fetchTikTokAdvertisers(fresh.accessToken);
    return NextResponse.json({
      advertisers: advertisers.map((a) => ({
        id: a.advertiser_id,
        name: a.advertiser_name ?? `Advertiser ${a.advertiser_id}`,
      })),
    });
  } catch (err) {
    console.error("[api:tiktok:advertisers] failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not load TikTok advertisers" },
      { status: 500 },
    );
  }
}
