"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  IPAPI_TIMEOUT_MS,
  countryCodeToCurrency,
  detectCountryCode,
  readCachedCountry,
  readPricingCurrencyPreference,
  resolveInitialPricingCurrency,
  writePricingCurrencyPreference,
  type PricingCurrency,
} from "@/lib/currency";

type PricingCurrencyContextValue = {
  currency: PricingCurrency;
  setCurrency: (currency: PricingCurrency) => void;
  /** True once geo detection finished (or was skipped due to saved preference). */
  ready: boolean;
};

const PricingCurrencyContext = createContext<PricingCurrencyContextValue | null>(null);

export function PricingCurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<PricingCurrency>(() => resolveInitialPricingCurrency());
  const [ready, setReady] = useState(() => !!readPricingCurrencyPreference() || !!readCachedCountry());

  useEffect(() => {
    if (readPricingCurrencyPreference()) {
      setReady(true);
      return;
    }

    const cached = readCachedCountry();
    if (cached) {
      setCurrencyState(countryCodeToCurrency(cached.countryCode));
      setReady(true);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), IPAPI_TIMEOUT_MS);

    detectCountryCode(controller.signal)
      .then((countryCode) => {
        if (!readPricingCurrencyPreference()) {
          setCurrencyState(countryCodeToCurrency(countryCode));
        }
      })
      .catch(() => {
        // Geo blocked or failed — keep USD default for international-safe fallback.
      })
      .finally(() => {
        clearTimeout(timeout);
        setReady(true);
      });

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  const setCurrency = useCallback((next: PricingCurrency) => {
    writePricingCurrencyPreference(next);
    setCurrencyState(next);
  }, []);

  const value = useMemo(() => ({ currency, setCurrency, ready }), [currency, setCurrency, ready]);

  return <PricingCurrencyContext.Provider value={value}>{children}</PricingCurrencyContext.Provider>;
}

export function usePricingCurrency(): PricingCurrencyContextValue {
  const ctx = useContext(PricingCurrencyContext);
  if (!ctx) {
    throw new Error("usePricingCurrency must be used within PricingCurrencyProvider");
  }
  return ctx;
}

/** Safe optional hook for components that may render outside the provider. */
export function usePricingCurrencyOptional(): PricingCurrencyContextValue | null {
  return useContext(PricingCurrencyContext);
}
