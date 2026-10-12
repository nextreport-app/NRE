"use client";

import { useSiteTheme } from "@/components/site-theme-provider";
import { footerCopy, footerLinkLabel } from "@/lib/footer-i18n";
import { homeCopy } from "@/lib/home-i18n";
import { marketingCopy } from "@/lib/marketing-i18n";
import type { SiteLocaleId } from "@/lib/site-theme";

export function useSiteCopy() {
  const { locale } = useSiteTheme();
  return siteCopyForLocale(locale);
}

export function siteCopyForLocale(locale: SiteLocaleId) {
  const marketing = marketingCopy(locale);
  const footer = footerCopy(locale);
  const home = homeCopy(locale);
  return {
    locale,
    marketing,
    footer,
    home,
    linkLabel: (href: string, fallback: string) => footerLinkLabel(locale, href, fallback),
  };
}
