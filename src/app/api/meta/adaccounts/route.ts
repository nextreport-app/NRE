import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiErrorResponse } from "@/lib/api-error";
import { ensureFreshMetaAccessToken, fetchMetaAdAccounts } from "@/lib/meta-api";

/**
 * Lists Meta ad accounts the connected user can read — read-only Marketing
 * API call used to verify ads_read access (App Review + account settings).
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        metaAdsEnabled: true,
        metaAccessToken: true,
        metaTokenExpiresAt: true,
        metaConnectedName: true,
        metaConnectedUserId: true,
      },
    });

    if (!user?.metaAdsEnabled || !user.metaAccessToken) {
      return NextResponse.json({ error: "Meta Ads not connected" }, { status: 400 });
    }

    const fresh = await ensureFreshMetaAccessToken({
      accessToken: user.metaAccessToken,
      tokenExpiresAt: user.metaTokenExpiresAt,
    });

    if (fresh.refreshed) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          metaAccessToken: fresh.accessToken,
          metaTokenExpiresAt: fresh.tokenExpiresAt,
        },
      });
    }

    const accounts = await fetchMetaAdAccounts(fresh.accessToken);

    return NextResponse.json({
      connectedAs: user.metaConnectedName,
      connectedUserId: user.metaConnectedUserId,
      accounts: accounts.map((a) => ({
        id: a.id,
        name: a.name,
        accountId: a.account_id,
        accountStatus: a.account_status,
      })),
    });
  } catch (err) {
    return apiErrorResponse(err, "meta:adaccounts");
  }
}
