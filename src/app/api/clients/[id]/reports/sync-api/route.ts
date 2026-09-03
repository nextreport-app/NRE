import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiErrorResponse } from "@/lib/api-error";
import { ensureFreshMetaAccessToken } from "@/lib/meta-api";
import { refreshGoogleAdsAccessToken } from "@/lib/google-ads-api";
import { fetchMetaReportCsv } from "@/lib/nre/fetch-meta-report-rows";
import { fetchGoogleReportCsv } from "@/lib/nre/fetch-google-report-rows";
import { platformSchema } from "@/lib/validators/report-wizard";

const syncApiBodySchema = z.object({
  platform: platformSchema,
  metaAdAccountId: z.string().trim().min(1).optional(),
  googleCustomerId: z.string().trim().min(1).optional(),
});

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

    const { platform, metaAdAccountId, googleCustomerId } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        metaAdsEnabled: true,
        metaAccessToken: true,
        metaTokenExpiresAt: true,
        googleAdsRefreshToken: true,
        googleAdsAccessToken: true,
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

      return NextResponse.json({
        ok: true,
        platform: "META",
        csvText: result.csvText,
        rowCount: result.rowCount,
        sinceIso: result.sinceIso,
        untilIso: result.untilIso,
        fileName: `meta-api-sync-${result.untilIso}.csv`,
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

    return NextResponse.json({
      ok: true,
      platform: "GOOGLE",
      csvText: result.csvText,
      rowCount: result.rowCount,
      sinceIso: result.sinceIso,
      untilIso: result.untilIso,
      fileName: `google-ads-api-sync-${result.untilIso}.csv`,
    });
  } catch (err) {
    return apiErrorResponse(err, "reports:sync-api");
  }
}
