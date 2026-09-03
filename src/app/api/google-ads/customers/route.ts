import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiErrorResponse } from "@/lib/api-error";
import {
  listAccessibleGoogleAdsCustomers,
  refreshGoogleAdsAccessToken,
} from "@/lib/google-ads-api";

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

    let accessToken = user.googleAdsAccessToken ?? "";
    try {
      const refreshed = await refreshGoogleAdsAccessToken(user.googleAdsRefreshToken);
      accessToken = refreshed.access_token;
      await prisma.user.update({
        where: { id: session.user.id },
        data: { googleAdsAccessToken: accessToken },
      });
    } catch {
      /* use stored access token if refresh fails */
      if (!accessToken) throw new Error("Could not obtain Google Ads access token");
    }

    const resourceNames = await listAccessibleGoogleAdsCustomers(accessToken);
    const customers = resourceNames.map((name) => {
      const id = name.replace(/^customers\//, "");
      return { id, resourceName: name };
    });

    return NextResponse.json({ customers });
  } catch (err) {
    return apiErrorResponse(err, "google-ads:customers");
  }
}
