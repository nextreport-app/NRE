/**
 * Pricing-currency detection for /pricing — pure mapping logic, kept
 * separate from the client component that calls ipapi.co so the "which
 * currency does this country get" rule is unit-testable without a real
 * network call or a browser DOM.
 */

export type PricingCurrency = "INR" | "USD";

/** India shows INR; every other country (US, CA, UK/GB, AU, all of Europe, everyone else) shows USD — see the /pricing spec's exact wording. */
export function countryCodeToCurrency(countryCode: string | null | undefined): PricingCurrency {
  return countryCode?.trim().toUpperCase() === "IN" ? "INR" : "USD";
}

// localStorage cache for the ipapi.co-detected country code — avoids a
// visible USD->INR (or INR->USD) flash on every repeat visit by skipping
// the network round trip entirely once a detection result is on hand.
// Keyed/versioned so a future change to what's stored can invalidate old
// entries just by bumping the suffix, no migration needed.
const CACHE_KEY = "nre_pricing_country_v1";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export interface CachedCountry {
  countryCode: string | null;
  cachedAt: number;
}

/** Reads the cached country code, or null if there's nothing cached, it's malformed, or it's past the 24h TTL. Never throws — localStorage can be unavailable (private browsing, disabled) or hold garbage from an older version. */
export function readCachedCountry(storage: Pick<Storage, "getItem"> = globalThis.localStorage): CachedCountry | null {
  try {
    const raw = storage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedCountry>;
    if (typeof parsed.cachedAt !== "number") return null;
    if (Date.now() - parsed.cachedAt > CACHE_TTL_MS) return null;
    return { countryCode: parsed.countryCode ?? null, cachedAt: parsed.cachedAt };
  } catch {
    return null;
  }
}

/** Best-effort write — a full/disabled storage quietly falls back to "detect again next time," never breaks the pricing page itself. */
export function writeCachedCountry(countryCode: string | null, storage: Pick<Storage, "setItem"> = globalThis.localStorage): void {
  try {
    storage.setItem(CACHE_KEY, JSON.stringify({ countryCode, cachedAt: Date.now() } satisfies CachedCountry));
  } catch {
    // Ignore — see file header.
  }
}
