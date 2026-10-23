import { prisma } from "@/lib/prisma";
import { ensureFreshMetaAccessToken, fetchMetaCustomConversions, type MetaCustomConversion } from "@/lib/meta-api";
import { getMetaResultLabels } from "./meta-objective-dictionary";
import { resolveObjectiveFromResultType } from "./result-type-map";

/** Maps Meta custom conversion id → Ads Reporting-style Result type text. */
export type MetaCustomConversionResultTypeMap = Record<string, string>;

/** Turn a custom conversion name from Graph API into our synthetic result_type string. */
export function syntheticResultTypeFromCustomConversionName(name: string): string {
  const n = name.trim();
  if (!n) return "website submission";

  const fromExact = resolveObjectiveFromResultType(n);
  if (fromExact?.key === "quote_requests") return "Quote Request Submitted";

  const meta = getMetaResultLabels(n);
  if (meta.key === "quote_requests") return "Quote Request Submitted";
  if (meta.key === "website_leads") return "website submission";
  if (meta.resultLabel !== "RESULTS") return n;

  if (/quote[\s_]*request/i.test(n)) return "Quote Request Submitted";
  if (/website submission|website lead|web lead/i.test(n)) return "website submission";
  return n;
}

export function buildMetaCustomConversionResultTypeMap(
  conversions: MetaCustomConversion[],
): MetaCustomConversionResultTypeMap {
  const out: MetaCustomConversionResultTypeMap = {};
  for (const c of conversions) {
    const id = String(c.id ?? "").trim();
    const name = String(c.name ?? "").trim();
    if (!id || !name) continue;
    out[id] = syntheticResultTypeFromCustomConversionName(name);
  }
  return out;
}

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
    accessToken: user.metaAccessToken,
    tokenExpiresAt: user.metaTokenExpiresAt,
  });

  if (fresh.refreshed) {
    await prisma.user.update({
      where: { id: userId },
      data: { metaAccessToken: fresh.accessToken, metaTokenExpiresAt: fresh.tokenExpiresAt },
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
