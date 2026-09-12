import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiErrorResponse } from "@/lib/api-error";
import { ensureFreshMetaAccessToken } from "@/lib/meta-api";
import { refreshGoogleAdsAccessToken } from "@/lib/google-ads-api";
import { ensureFreshTikTokAccessToken } from "@/lib/tiktok-api";
import { fetchMetaReportCsv } from "@/lib/nre/fetch-meta-report-rows";
import {
  maybeSyncPreviousMonthDataFromGoogleApi,
  maybeSyncPreviousMonthDataFromMetaApi,
  maybeSyncPreviousMonthDataFromTikTokApi,
  type PreviousMonthSyncResult,
} from "@/lib/nre/sync-previous-month-from-api";
import { fetchGoogleReportCsv } from "@/lib/nre/fetch-google-report-rows";
import { fetchTikTokReportCsv } from "@/lib/nre/fetch-tiktok-report-rows";
import {
  loadPreviousMonthDataCampaigns,
  parsePreviousMonthSelectedCampaigns,
} from "@/lib/nre/previous-month-data";
import { platformSchema } from "@/lib/validators/report-wizard";

const syncApiBodySchema = z.object({
  platform: platformSchema,
  metaAdAccountId: z.string().trim().min(1).optional(),
  googleCustomerId: z.string().trim().min(1).optional(),
  tiktokAdvertiserId: z.string().trim().min(1).optional(),
});

async function previousMonthPayloadFromClient(client: {
  previousMonthDataUrl: string | null;
  previousMonthDataUpdatedAt: Date | null;
  previousMonthSelectedCampaigns: string | null;
}) {
  if (!client.previousMonthDataUrl) {
    return {
      hasPreviousMonthData: false,
      previousMonthSynced: false,
      previousMonthCampaigns: [] as string[],
      previousMonthSelectedCampaigns: null as string[] | null,
      previousMonthUpdatedAt: null as string | null,
    };
  }

  let campaigns: string[] = [];
  try {
    campaigns = await loadPreviousMonthDataCampaigns(client.previousMonthDataUrl);
  } catch {
    campaigns = [];
  }
  const selected =
    parsePreviousMonthSelectedCampaigns(client.previousMonthSelectedCampaigns) ?? campaigns;

  return {
    hasPreviousMonthData: true,
    previousMonthSynced: false,
    previousMonthCampaigns: campaigns,
    previousMonthSelectedCampaigns: selected,
    previousMonthUpdatedAt: client.previousMonthDataUpdatedAt?.toISOString() ?? null,
  };
}

function previousMonthPayloadFromSync(
  sync: PreviousMonthSyncResult,
  client: {
    previousMonthDataUrl: string | null;
    previousMonthDataUpdatedAt: Date | null;
  },
) {
  return {
    hasPreviousMonthData: true,
    previousMonthSynced: sync.synced,
    previousMonthCampaigns: sync.campaigns ?? [],
    previousMonthSelectedCampaigns: sync.selectedCampaigns ?? sync.campaigns ?? [],
    previousMonthUpdatedAt: sync.synced
      ? new Date().toISOString()
      : client.previousMonthDataUpdatedAt?.toISOString() ?? null,
  };
}

/**
 * Fetches campaign data from Meta Marketing API or Google Ads API and returns
 * CSV text the wizard can treat like a manual upload — same NRE pipeline from
 * there on.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const client = await prisma.client.findUnique({ where: { id } });
    if (!client || client.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    const parsed = syncApiBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
    }

    const { platform, metaAdAccountId, googleCustomerId, tiktokAdvertiserId } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        metaAdsEnabled: true,
        metaAccessToken: true,
        metaTokenExpiresAt: true,
        googleAdsRefreshToken: true,
        googleAdsAccessToken: true,
        tiktokAdsEnabled: true,
        tiktokAccessToken: true,
        tiktokRefreshToken: true,
        tiktokTokenExpiresAt: true,
      },
    });

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    if (platform === "META") {
      if (!metaAdAccountId) {
        return NextResponse.json({ error: "metaAdAccountId is required for Meta sync" }, { status: 400 });
      }
      if (!user.metaAdsEnabled || !user.metaAccessToken) {
        return NextResponse.json({ error: "Meta Ads is not connected" }, { status: 400 });
      }

      const fresh = await ensureFreshMetaAccessToken({
        accessToken: user.metaAccessToken,
        tokenExpiresAt: user.metaTokenExpiresAt,
      });

      if (fresh.refreshed) {
        await prisma.user.update({
          where: { id: session.user.id },
          data: { metaAccessToken: fresh.accessToken, metaTokenExpiresAt: fresh.tokenExpiresAt },
        });
      }

      const result = await fetchMetaReportCsv({
        accessToken: fresh.accessToken,
        adAccountId: metaAdAccountId,
        timezone: client.timezone,
      });

      let previousMonth = await previousMonthPayloadFromClient(client);
      try {
        const prevMonth = await maybeSyncPreviousMonthDataFromMetaApi({
          clientId: client.id,
          accessToken: fresh.accessToken,
          adAccountId: metaAdAccountId,
          timezone: client.timezone,
          previousMonthDataUrl: client.previousMonthDataUrl,
          previousMonthDataUpdatedAt: client.previousMonthDataUpdatedAt,
          previousMonthSelectedCampaigns: client.previousMonthSelectedCampaigns,
        });
        if (prevMonth.campaigns) {
          previousMonth = previousMonthPayloadFromSync(prevMonth, client);
        }
      } catch (err) {
        console.error("[reports:sync-api] previous month auto-sync failed:", err);
      }

      return NextResponse.json({
        ok: true,
        platform: "META",
        csvText: result.csvText,
        rowCount: result.rowCount,
        sinceIso: result.sinceIso,
        untilIso: result.untilIso,
        fileName: `meta-api-sync-${result.untilIso}.csv`,
        ...previousMonth,
      });
    }

    if (platform === "TIKTOK") {
      if (!tiktokAdvertiserId) {
        return NextResponse.json({ error: "tiktokAdvertiserId is required for TikTok sync" }, { status: 400 });
      }
      if (!user.tiktokAdsEnabled || !user.tiktokAccessToken) {
        return NextResponse.json({ error: "TikTok Ads is not connected" }, { status: 400 });
      }

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

      const result = await fetchTikTokReportCsv({
        accessToken: fresh.accessToken,
        advertiserId: tiktokAdvertiserId,
        timezone: client.timezone,
      });

      let previousMonth = await previousMonthPayloadFromClient(client);
      try {
        const prevMonth = await maybeSyncPreviousMonthDataFromTikTokApi({
          clientId: client.id,
          accessToken: fresh.accessToken,
          advertiserId: tiktokAdvertiserId,
          timezone: client.timezone,
          previousMonthDataUrl: client.previousMonthDataUrl,
          previousMonthDataUpdatedAt: client.previousMonthDataUpdatedAt,
          previousMonthSelectedCampaigns: client.previousMonthSelectedCampaigns,
        });
        if (prevMonth.campaigns) {
          previousMonth = previousMonthPayloadFromSync(prevMonth, client);
        }
      } catch (err) {
        console.error("[reports:sync-api] TikTok previous month auto-sync failed:", err);
      }

      return NextResponse.json({
        ok: true,
        platform: "TIKTOK",
        csvText: result.csvText,
        rowCount: result.rowCount,
        sinceIso: result.sinceIso,
        untilIso: result.untilIso,
        fileName: `tiktok-api-sync-${result.untilIso}.csv`,
        ...previousMonth,
      });
    }

    if (!googleCustomerId) {
      return NextResponse.json({ error: "googleCustomerId is required for Google sync" }, { status: 400 });
    }
    if (!user.googleAdsRefreshToken) {
      return NextResponse.json({ error: "Google Ads is not connected" }, { status: 400 });
    }

    let accessToken = user.googleAdsAccessToken ?? "";
    try {
      const refreshed = await refreshGoogleAdsAccessToken(user.googleAdsRefreshToken);
      accessToken = refreshed.access_token;
      await prisma.user.update({
        where: { id: session.user.id },
        data: { googleAdsAccessToken: accessToken },
      });
    } catch {
      if (!accessToken) throw new Error("Could not obtain Google Ads access token");
    }

    const result = await fetchGoogleReportCsv({
      accessToken,
      customerId: googleCustomerId,
      timezone: client.timezone,
    });

    let previousMonth = await previousMonthPayloadFromClient(client);
    try {
      const prevMonth = await maybeSyncPreviousMonthDataFromGoogleApi({
        clientId: client.id,
        accessToken,
        customerId: googleCustomerId,
        timezone: client.timezone,
        previousMonthDataUrl: client.previousMonthDataUrl,
        previousMonthDataUpdatedAt: client.previousMonthDataUpdatedAt,
        previousMonthSelectedCampaigns: client.previousMonthSelectedCampaigns,
      });
      if (prevMonth.campaigns) {
        previousMonth = previousMonthPayloadFromSync(prevMonth, client);
      }
    } catch (err) {
      console.error("[reports:sync-api] Google previous month auto-sync failed:", err);
    }

    return NextResponse.json({
      ok: true,
      platform: "GOOGLE",
      csvText: result.csvText,
      rowCount: result.rowCount,
      sinceIso: result.sinceIso,
      untilIso: result.untilIso,
      fileName: `google-ads-api-sync-${result.untilIso}.csv`,
      ...previousMonth,
    });
  } catch (err) {
    return apiErrorResponse(err, "reports:sync-api");
  }
}
