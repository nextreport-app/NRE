import { apiErrorResponse } from "@/lib/api-error";
import { resolveClientUserById, updateResolvedProviderUser } from "@/lib/client-provider-connections";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureFreshTikTokAccessToken, fetchTikTokAdvertisers } from "@/lib/tiktok-api";

/** Lists TikTok advertiser accounts the connected user can access. */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
  const user = await resolveClientUserById(await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      tiktokAdsEnabled: true,
      tiktokAccessToken: true,
      tiktokRefreshToken: true,
      tiktokTokenExpiresAt: true,
      tiktokAdvertiserIds: true,
    },
  }), session.user.id, new URL(req.url).searchParams.get("clientId"));

  if (!user?.tiktokAdsEnabled || !user.tiktokAccessToken) {
    return NextResponse.json({ error: "TikTok Ads is not connected" }, { status: 400 });
  }

    const fresh = await ensureFreshTikTokAccessToken({
      accessToken: user.tiktokAccessToken,
      refreshToken: user.tiktokRefreshToken,
      tokenExpiresAt: user.tiktokTokenExpiresAt,
    });

    if (fresh.refreshed) {
      await updateResolvedProviderUser({
        where: { id: session.user.id },
        data: {
          tiktokAccessToken: fresh.accessToken,
          tiktokRefreshToken: fresh.refreshToken,
          tiktokTokenExpiresAt: fresh.tokenExpiresAt,
        },
      }, user);
    }

    const advertisers = await fetchTikTokAdvertisers(fresh.accessToken);
    return NextResponse.json({
      advertisers: advertisers.map((a) => ({
        id: a.advertiser_id,
        name: a.advertiser_name ?? `Advertiser ${a.advertiser_id}`,
      })),
    });
  } catch (err) {
    return apiErrorResponse(err,"tiktok:advertisers");
  }
}
