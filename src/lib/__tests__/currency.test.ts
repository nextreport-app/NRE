import { describe, expect, it, vi } from "vitest";
import {
  countryCodeToCurrency,
  readCachedCountry,
  readPricingCurrencyPreference,
  resolveInitialPricingCurrency,
  writeCachedCountry,
  writePricingCurrencyPreference,
  type CachedCountry,
} from "../currency";

/** Minimal in-memory Storage stand-in — avoids depending on jsdom's real localStorage just for these two functions. */
function fakeStorage(initial: Record<string, string> = {}): Storage {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
    key: () => null,
    get length() {
      return store.size;
    },
  } as Storage;
}

describe("countryCodeToCurrency", () => {
  it("maps India to INR", () => {
    expect(countryCodeToCurrency("IN")).toBe("INR");
  });

  it("is case-insensitive", () => {
    expect(countryCodeToCurrency("in")).toBe("INR");
  });

  it("tolerates surrounding whitespace", () => {
    expect(countryCodeToCurrency(" IN ")).toBe("INR");
  });

  it.each(["US", "CA", "GB", "AU", "DE", "FR", "NZ", "SG", "ZZ"])(
    "maps %s to USD",
    (code) => {
      expect(countryCodeToCurrency(code)).toBe("USD");
    },
  );

  it("defaults to USD when the country cannot be detected (null, undefined, or empty)", () => {
    expect(countryCodeToCurrency(null)).toBe("USD");
    expect(countryCodeToCurrency(undefined)).toBe("USD");
    expect(countryCodeToCurrency("")).toBe("USD");
  });
});

describe("readCachedCountry / writeCachedCountry", () => {
  it("round-trips a written country code", () => {
    const storage = fakeStorage();
    writeCachedCountry("IN", storage);
    expect(readCachedCountry(storage)).toEqual({ countryCode: "IN", cachedAt: expect.any(Number) });
  });

  it("round-trips a null country code (detection ran but returned nothing)", () => {
    const storage = fakeStorage();
    writeCachedCountry(null, storage);
    expect(readCachedCountry(storage)).toEqual({ countryCode: null, cachedAt: expect.any(Number) });
  });

  it("returns null when nothing is cached", () => {
    expect(readCachedCountry(fakeStorage())).toBeNull();
  });

  it("returns null for malformed JSON rather than throwing", () => {
    expect(readCachedCountry(fakeStorage({ nre_pricing_country_v1: "{not json" }))).toBeNull();
  });

  it("returns null once the 24h TTL has passed", () => {
    const storage = fakeStorage();
    const entry: CachedCountry = { countryCode: "US", cachedAt: Date.now() - 25 * 60 * 60 * 1000 };
    storage.setItem("nre_pricing_country_v1", JSON.stringify(entry));
    expect(readCachedCountry(storage)).toBeNull();
  });

  it("still applies just under the 24h TTL", () => {
    const storage = fakeStorage();
    const entry: CachedCountry = { countryCode: "US", cachedAt: Date.now() - 23 * 60 * 60 * 1000 };
    storage.setItem("nre_pricing_country_v1", JSON.stringify(entry));
    expect(readCachedCountry(storage)).toEqual(entry);
  });

  it("writeCachedCountry never throws even if storage.setItem throws (quota exceeded, disabled, etc.)", () => {
    const storage: Pick<Storage, "setItem"> = {
      setItem: vi.fn(() => {
        throw new Error("QuotaExceededError");
      }),
    };
    expect(() => writeCachedCountry("IN", storage)).not.toThrow();
  });

  it("readCachedCountry never throws even if storage.getItem throws", () => {
    const storage: Pick<Storage, "getItem"> = {
      getItem: vi.fn(() => {
        throw new Error("SecurityError");
      }),
    };
    expect(() => readCachedCountry(storage)).not.toThrow();
    expect(readCachedCountry(storage)).toBeNull();
  });
});

describe("pricing currency preference", () => {
  it("round-trips INR and USD preference", () => {
    const storage = fakeStorage();
    writePricingCurrencyPreference("USD", storage);
    expect(readPricingCurrencyPreference(storage)).toBe("USD");
    writePricingCurrencyPreference("INR", storage);
    expect(readPricingCurrencyPreference(storage)).toBe("INR");
  });

  it("returns null for invalid stored values", () => {
    const storage = fakeStorage({ nre_pricing_currency_v1: "EUR" });
    expect(readPricingCurrencyPreference(storage)).toBeNull();
  });

  it("resolveInitialPricingCurrency prefers saved preference over geo cache", () => {
    const storage = fakeStorage();
    writeCachedCountry("IN", storage);
    writePricingCurrencyPreference("USD", storage);
    expect(resolveInitialPricingCurrency(storage)).toBe("USD");
  });

  it("resolveInitialPricingCurrency falls back to cached geo when no preference", () => {
    const storage = fakeStorage();
    writeCachedCountry("US", storage);
    expect(resolveInitialPricingCurrency(storage)).toBe("USD");
  });

  it("defaults to USD when no preference or geo cache (international-safe first paint)", () => {
    expect(resolveInitialPricingCurrency(fakeStorage())).toBe("USD");
  });

  it("maps cached India to INR on first paint", () => {
    const storage = fakeStorage();
    writeCachedCountry("IN", storage);
    expect(resolveInitialPricingCurrency(storage)).toBe("INR");
  });
});
