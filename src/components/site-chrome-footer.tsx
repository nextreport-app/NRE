"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { SocialLinks } from "@/components/social-links";
import { FooterLinkColumn } from "@/components/footer-link-column";
import { NewsletterSignup } from "@/components/newsletter-signup";
import { BETA_HIDE_PRICING } from "@/lib/beta";
import {
  FOOTER_COMPANY_LINKS,
  FOOTER_LEGAL_LINKS,
  FOOTER_PRODUCT_LINKS,
  SUPPORT_EMAIL,
  WHATSAPP_URL,
  filterBetaLinks,
} from "@/lib/site-links";

/**
 * Site-wide footer + floating WhatsApp button, rendered from the root
 * layout on every page EXCEPT the public /r/[token] share page.
 */
export function SiteChromeFooter() {
  const pathname = usePathname();
  if (pathname?.startsWith("/r/") || pathname?.startsWith("/print/")) return null;

  const productLinks = filterBetaLinks(FOOTER_PRODUCT_LINKS, BETA_HIDE_PRICING);

  return (
    <>
      <footer className="site-footer border-t border-navy-border bg-navy px-6 py-12 sm:py-14">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
            {/* 1 — Brand */}
            <div className="sm:col-span-2 lg:col-span-1">
              <Link href="/" className="inline-flex items-center gap-2">
                <img src="/logo.png" alt="NextReport logo" className="h-8 w-8" />
                <span className="text-base font-bold text-white">NextReport</span>
              </Link>
              <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-muted">
                Automated Meta and Google Ads reporting for digital agencies — client-ready decks in under two minutes.
              </p>
              <div className="mt-5">
                <SocialLinks />
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full border border-navy-border bg-navy-panel px-2.5 py-1 text-[11px] font-medium text-ink-muted">
                  Meta API approved
                </span>
                <span className="rounded-full border border-navy-border bg-navy-panel px-2.5 py-1 text-[11px] font-medium text-ink-muted">
                  Google Ads API
                </span>
              </div>
            </div>

            {/* 2 — Product */}
            <FooterLinkColumn title="Product" links={productLinks} />

            {/* 3 — Company & legal */}
            <div>
              <FooterLinkColumn title="Company" links={FOOTER_COMPANY_LINKS} />
              <div className="mt-8">
                <FooterLinkColumn title="Legal" links={FOOTER_LEGAL_LINKS} />
              </div>
            </div>

            {/* 4 — Get in touch */}
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-white">Get in touch</h3>
              <p className="mt-4 text-sm leading-relaxed text-ink-muted">
                Questions about setup, pricing, or a custom agency workflow? Our team typically replies within one business day.
              </p>
              <div className="mt-4 space-y-3 text-sm">
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="flex items-center gap-2 font-medium text-white transition-colors hover:text-accent"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true">
                    <path strokeLinecap="round" d="M4 6h16v12H4z" />
                    <path strokeLinecap="round" d="m4 7 8 6 8-6" />
                  </svg>
                  {SUPPORT_EMAIL}
                </a>
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-ink-muted transition-colors hover:text-white"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 shrink-0" aria-hidden="true">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.75.75 0 0 0 .917.917l4.458-1.495A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 0 1-5.006-1.371l-.358-.213-2.642.886.886-2.577-.233-.375A9.818 9.818 0 1 1 12 21.818z" />
                  </svg>
                  Chat on WhatsApp
                </a>
              </div>
              <p className="mt-4 text-xs leading-relaxed text-ink-muted">
                Serving agencies worldwide — pay in{" "}
                <span className="font-medium text-ink-secondary">INR</span> (India) or{" "}
                <span className="font-medium text-ink-secondary">USD</span> (international).
              </p>
              <div className="mt-5 border-t border-navy-border pt-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">Stay updated</p>
                <div className="mt-3">
                  <NewsletterSignup compact />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-10 space-y-4 border-t border-navy-border pt-8">
            <div className="flex flex-col items-center justify-between gap-3 text-center sm:flex-row sm:text-left">
              <p className="text-xs text-ink-muted">© 2026 NextReport. All rights reserved.</p>
              <p className="flex items-center justify-center gap-1.5 text-xs text-ink-muted">
                Made with
                <span className="text-red-400" aria-label="love">
                  ♥
                </span>
                for digital agencies. Automate your ad reporting.
              </p>
            </div>
            <p className="text-center text-[11px] leading-relaxed text-ink-muted/80 sm:text-left">
              Meta and Google are trademarks of their respective owners. NextReport is an independent tool and is not
              affiliated with Meta Platforms, Inc. or Google LLC.
            </p>
          </div>
        </div>
      </footer>
      <WhatsAppButton />
    </>
  );
}
