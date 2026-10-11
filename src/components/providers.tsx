"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";
import { PricingCurrencyProvider } from "@/components/pricing-currency-provider";
import { SiteThemeProvider } from "@/components/site-theme-provider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <SiteThemeProvider>
        <PricingCurrencyProvider>{children}</PricingCurrencyProvider>
      </SiteThemeProvider>
    </SessionProvider>
  );
}
