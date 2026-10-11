"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { SocialLinks } from "@/components/social-links";
import { FooterLinkColumn } from "@/components/footer-link-column";
import { SiteThemeControls } from "@/components/site-theme-controls";
import { BETA_HIDE_PRICING } from "@/lib/beta";
import {
  FOOTER_COMPANY_LINKS,
  FOOTER_LEGAL_LINKS,
  FOOTER_PRODUCT_LINKS,
  SUPPORT_EMAIL,
  filterBetaLinks,
} from "@/lib/site-links";
import { footerCopy, footerLinkLabel } from "@/lib/footer-i18n";
import { useSiteTheme } from "@/components/site-theme-provider";

/**
 * Site-wide footer + floating WhatsApp button, rendered from the root
 * layout on every page EXCEPT the public /r/[token] share page.
 */
export function SiteChromeFooter() {
  const pathname = usePathname();
  const { locale } = useSiteTheme();

  if (pathname?.startsWith("/r/") || pathname?.startsWith("/print/")) return null;

  const copy = footerCopy(locale);
  const productLinks = filterBetaLinks(FOOTER_PRODUCT_LINKS, BETA_HIDE_PRICING).map((link) => ({
    href: link.href,
    label: footerLinkLabel(locale, link.href, link.label),
  }));
  const companyLinks = FOOTER_COMPANY_LINKS.map((link) => ({
    href: link.href,
    label: footerLinkLabel(locale, link.href, link.label),
  }));
  const legalLinks = FOOTER_LEGAL_LINKS.map((link) => ({
    href: link.href,
    label: footerLinkLabel(locale, link.href, link.label),
  }));

  return (
    <>
      <footer className="site-footer border-t border-navy-border bg-navy px-4 py-10 sm:px-6 sm:py-12">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-5 lg:gap-6">
            <div className="col-span-2 sm:col-span-3 lg:col-span-1">
              <Link href="/" className="inline-flex items-center gap-2">
                <img src="/logo.png" alt="NextReport logo" className="h-8 w-8" />
                <span className="text-base font-bold text-ink">NextReport</span>
              </Link>
              <p className="mt-3 text-sm text-ink-muted">Meta client reporting for agencies.</p>
              <div className="mt-4">
                <SocialLinks />
              </div>
            </div>

            <FooterLinkColumn title={copy.product} links={productLinks} />
            <FooterLinkColumn title={copy.company} links={companyLinks} />
            <FooterLinkColumn title={copy.legal} links={legalLinks} />

            <div>
              <h3 className="text-sm font-semibold text-ink">{copy.connect}</h3>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="mt-4 block text-sm text-ink-muted transition-colors hover:text-ink"
              >
                {SUPPORT_EMAIL}
              </a>
            </div>
          </div>

          {copy.uiEnglishNote ? (
            <p className="mt-8 text-center text-xs text-ink-muted lg:text-left">{copy.uiEnglishNote}</p>
          ) : null}

          <div className="mt-8 flex flex-col gap-4 border-t border-navy-border pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-center text-xs text-ink-muted sm:text-left">{copy.copyright}</p>
            <SiteThemeControls />
          </div>

          <p className="mt-4 text-center text-[11px] leading-relaxed text-ink-muted/90 sm:text-left">
            Meta, Google, TikTok, and Google Analytics are trademarks of their respective owners. NextReport is not
            affiliated with Meta Platforms, Inc., Google LLC, or TikTok Inc.
          </p>
        </div>
      </footer>
      <WhatsAppButton />
    </>
  );
}
