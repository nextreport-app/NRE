import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiErrorResponse } from "@/lib/api-error";
import {
  listAccessibleGoogleAdsCustomers,
  refreshGoogleAdsAccessToken,
} from "@/lib/google-ads-api";
import { googleOAuthReconnectMessage, isGoogleOAuthRefreshFailure } from "@/lib/google-oauth-refresh-error";

/** Lists Google Ads customer IDs the connected user can access — verifies API access. */
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { googleAdsRefreshToken: true, googleAdsAccessToken: true },
    });

    if (!user?.googleAdsRefreshToken) {
      return NextResponse.json({ error: "Google Ads is not connected" }, { status: 400 });
    }

    let accessToken: string;
    try {
      const refreshed = await refreshGoogleAdsAccessToken(user.googleAdsRefreshToken);
      accessToken = refreshed.access_token;
      await prisma.user.update({
        where: { id: session.user.id },
        data: { googleAdsAccessToken: accessToken },
      });
    } catch (refreshErr) {
      console.error("[google-ads:customers] token refresh failed:", refreshErr);
      return NextResponse.json({ error: googleOAuthReconnectMessage("Google Ads") }, { status: 400 });
    }

    let resourceNames: string[];
    try {
      resourceNames = await listAccessibleGoogleAdsCustomers(accessToken);
    } catch (apiErr) {
      if (isGoogleOAuthRefreshFailure(apiErr)) {
        return NextResponse.json({ error: googleOAuthReconnectMessage("Google Ads") }, { status: 400 });
      }
      throw apiErr;
    }
    const customers = resourceNames.map((name) => {
      const id = name.replace(/^customers\//, "");
      return { id, resourceName: name };
    });

    return NextResponse.json({ customers });
  } catch (err) {
    return apiErrorResponse(err, "google-ads:customers");
  }
}
