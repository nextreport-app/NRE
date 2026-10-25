import { headers } from "next/headers";

/** ISO 3166-1 alpha-2 country code from Vercel edge (e.g. IN, US). */
export async function getVisitorCountryCode(): Promise<string | null> {
  const h = await headers();
  const code = h.get("x-vercel-ip-country")?.trim().toUpperCase();
  return code && code.length === 2 ? code : null;
}

export function isIndiaCountryCode(countryCode: string | null | undefined): boolean {
  return countryCode === "IN";
}

/**
 * TikTok Ads wizard + marketing visibility (all regions).
 * Agencies in restricted markets can skip TikTok in the wizard; product no longer geo-hides the option.
 */
export function shouldShowTikTokToVisitor(_countryCode: string | null | undefined): boolean {
  return true;
}

export async function shouldShowTikTokForCurrentVisitor(): Promise<boolean> {
  return shouldShowTikTokToVisitor(await getVisitorCountryCode());
}
