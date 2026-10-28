import { headers } from "next/headers";

/** ISO 3166-1 alpha-2 country code from Vercel edge (e.g. IN, US). */
export async function getVisitorCountryCode(): Promise<string | null> {
  const h = await headers();
  const code = h.get("x-vercel-ip-country")?.trim().toUpperCase();
  return code && code.length === 2 ? code : null;
}

export function isIndiaCountryCode(countryCode: string | null | undefined): boolean {
  return countryCode?.trim().toUpperCase() === "IN";
}

/** TikTok connections/reporting are unavailable to visitors detected in India. */
export function shouldShowTikTokToVisitor(countryCode: string | null | undefined): boolean {
  return !isIndiaCountryCode(countryCode);
}

export async function shouldShowTikTokForCurrentVisitor(): Promise<boolean> {
  return shouldShowTikTokToVisitor(await getVisitorCountryCode());
}
