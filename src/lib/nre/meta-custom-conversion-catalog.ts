import { decryptMetaToken, encryptMetaToken } from "@/lib/meta-token-storage";
import { prisma } from "@/lib/prisma";
import { ensureFreshMetaAccessToken, fetchMetaCustomConversions } from "@/lib/meta-api";

import { buildMetaCustomConversionResultTypeMap, type MetaCustomConversionResultTypeMap } from "./meta-custom-conversion-labels";
export { buildMetaCustomConversionResultTypeMap, syntheticResultTypeFromCustomConversionName } from "./meta-custom-conversion-labels";
export type { MetaCustomConversionResultTypeMap } from "./meta-custom-conversion-labels";

export async function fetchMetaCustomConversionResultTypeMap(params: {
  accessToken: string;
  adAccountId: string;
}): Promise<MetaCustomConversionResultTypeMap> {
  const conversions = await fetchMetaCustomConversions(params.accessToken, params.adAccountId);
  return buildMetaCustomConversionResultTypeMap(conversions);
}

/** Best-effort catalog for wizard CSV analyze/metrics — returns undefined when Meta is not connected. */
export async function tryFetchMetaCustomConversionResultTypesForUser(
  userId: string,
  adAccountId: string | undefined | null,
): Promise<MetaCustomConversionResultTypeMap | undefined> {
  const accountId = adAccountId?.trim();
  if (!accountId) return undefined;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { metaAdsEnabled: true, metaAccessToken: true, metaTokenExpiresAt: true },
  });
  if (!user?.metaAdsEnabled || !user.metaAccessToken) return undefined;

  const fresh = await ensureFreshMetaAccessToken({
    accessToken: decryptMetaToken(user.metaAccessToken),
    tokenExpiresAt: user.metaTokenExpiresAt,
  });

  if (fresh.refreshed) {
    await prisma.user.update({
      where: { id: userId },
      data: { metaAccessToken: encryptMetaToken(fresh.accessToken), metaTokenExpiresAt: fresh.tokenExpiresAt },
    });
  }

  try {
    return await fetchMetaCustomConversionResultTypeMap({
      accessToken: fresh.accessToken,
      adAccountId: accountId,
    });
  } catch {
    return undefined;
  }
}
