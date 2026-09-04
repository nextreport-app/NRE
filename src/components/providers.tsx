"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";
import { PricingCurrencyProvider } from "@/components/pricing-currency-provider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <PricingCurrencyProvider>{children}</PricingCurrencyProvider>
    </SessionProvider>
  );
}
