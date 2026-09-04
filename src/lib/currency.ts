/**
 * Pricing-currency detection for /pricing — pure mapping logic, kept
 * separate from the client component that calls ipapi.co so the "which
 * currency does this country get" rule is unit-testable without a real
 * network call or a browser DOM.
 */

export type PricingCurrency = "INR" | "USD";

export const PRICING_CURRENCY_LABELS: Record<PricingCurrency, string> = {
  INR: "₹ INR",
  USD: "$ USD",
};

export const PRICING_CURRENCY_NOTE: Record<PricingCurrency, string> = {
  INR: "Prices in Indian Rupees. Pay with UPI, cards, or net banking.",
  USD: "International pricing in US Dollars. Billed in USD at checkout — agencies worldwide welcome.",
};

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

/** Explicit visitor choice — overrides geo detection on every page until cleared. */
const PREFERENCE_KEY = "nre_pricing_currency_v1";

export function readPricingCurrencyPreference(
  storage: Pick<Storage, "getItem"> = globalThis.localStorage,
): PricingCurrency | null {
  try {
    const raw = storage.getItem(PREFERENCE_KEY);
    if (raw === "INR" || raw === "USD") return raw;
    return null;
  } catch {
    return null;
  }
}

export function writePricingCurrencyPreference(
  currency: PricingCurrency,
  storage: Pick<Storage, "setItem"> = globalThis.localStorage,
): void {
  try {
    storage.setItem(PREFERENCE_KEY, currency);
  } catch {
    // Ignore — same rationale as writeCachedCountry.
  }
}

/** Best initial currency for client render — saved preference, cached geo, else USD until ipapi confirms India. */
export function resolveInitialPricingCurrency(
  storage: Pick<Storage, "getItem"> = globalThis.localStorage,
): PricingCurrency {
  const pref = readPricingCurrencyPreference(storage);
  if (pref) return pref;
  const cached = readCachedCountry(storage);
  if (cached) return countryCodeToCurrency(cached.countryCode);
  // USD default avoids flashing INR to international first-time visitors
  // before ipapi.co resolves; India is switched to INR once geo returns IN.
  return "USD";
}

export const IPAPI_URL = "https://ipapi.co/json/";
export const IPAPI_TIMEOUT_MS = 5000;

/** Detect country code via ipapi.co (browser-only). Caches result for pricing geo. */
export async function detectCountryCode(signal?: AbortSignal): Promise<string | null> {
  const cached = readCachedCountry();
  if (cached) return cached.countryCode;

  const res = await fetch(IPAPI_URL, { signal });
  if (!res.ok) throw new Error(`ipapi.co responded ${res.status}`);
  const data = (await res.json()) as { country_code?: string };
  const countryCode = data.country_code ?? null;
  writeCachedCountry(countryCode);
  return countryCode;
}
