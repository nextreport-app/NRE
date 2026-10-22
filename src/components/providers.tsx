"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";
import { PricingCurrencyProvider } from "@/components/pricing-currency-provider";
import { SiteThemeProvider } from "@/components/site-theme-provider";

export function Providers({
  children,
  initialVisitorCountryCode = null,
}: {
  children: ReactNode;
  initialVisitorCountryCode?: string | null;
}) {
  return (
    <SessionProvider>
      <SiteThemeProvider>
        <PricingCurrencyProvider initialVisitorCountryCode={initialVisitorCountryCode}>
          {children}
        </PricingCurrencyProvider>
      </SiteThemeProvider>
    </SessionProvider>
  );
}
