"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { SocialLinks } from "@/components/social-links";
import { BETA_HIDE_PRICING } from "@/lib/beta";

/**
 * Site-wide footer + floating WhatsApp button, rendered from the root
 * layout on every page EXCEPT the public /r/[token] share page, which
 * renders its own minimal footer instead (components/share-report-view.tsx).
 *
 * Gated by pathname rather than the CSS `:has()` trick /light-preview still
 * uses (see globals.css) — `:has()` isn't supported in every browser engine
 * a shared link might be opened in (older WebViews, some link-preview
 * crawlers), which let this full site chrome bleed through onto the share
 * page for those visitors even though the CSS rule for it existed.
 * usePathname() doesn't force the app into dynamic rendering the way
 * headers()/cookies() would: the pathname is already known from the URL
 * segment itself at render time, not from runtime request data.
 */
export function SiteChromeFooter() {
  const pathname = usePathname();
  if (pathname?.startsWith("/r/")) return null;

  return (
    <>
      <footer className="site-footer border-t border-navy-border bg-navy px-6 py-10">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            <div>
              <Link href="/" className="flex items-center gap-1.5">
                <img src="/logo.png" alt="NextReport logo" style={{ height: "28px", width: "28px", display: "block" }} />
                <span className="text-base font-bold text-white" style={{ fontFamily: "var(--font-inter), sans-serif" }}>
                  NextReport
                </span>
              </Link>
              <p className="mt-3 text-sm text-ink-muted">Automated ad reporting for digital agencies</p>
              <div className="mt-4">
                <SocialLinks />
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-white">Links</h3>
              <nav className="mt-3 flex flex-col gap-2 text-sm text-ink-muted">
                <Link href="/" className="hover:text-white">Home</Link>
                <Link href="/how-it-works" className="hover:text-white">How It Works</Link>
                <Link href="/help/download" className="hover:text-white">Download Guide</Link>
                <Link href="/about" className="hover:text-white">About Us</Link>
                <Link href="/contact" className="hover:text-white">Contact</Link>
                <Link href="/privacy" className="hover:text-white">Privacy</Link>
                <Link href="/data-deletion" className="hover:text-white">Data Deletion</Link>
                <Link href="/terms" className="hover:text-white">Terms</Link>
                {/* BETA: hidden during beta period — restore before public launch (see lib/beta.ts's BETA_HIDE_PRICING) */}
                {!BETA_HIDE_PRICING && (
                  <Link href="/pricing" className="hover:text-white">Pricing</Link>
                )}
              </nav>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-white">Get in touch</h3>
              <div className="mt-3 flex flex-col gap-2 text-sm text-ink-muted">
                <a href="mailto:hello@nextreport.in" className="hover:text-white">hello@nextreport.in</a>
                <p className="mt-1 text-xs text-ink-muted">Available in INR (India) and USD (International)</p>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col items-center justify-between gap-2 border-t border-navy-border pt-5 text-xs text-ink-muted sm:flex-row">
            <p>© 2026 NextReport. All rights reserved.</p>
            <p>Made for digital agencies. Automate your ad reporting.</p>
          </div>
        </div>
      </footer>
      {/* Hidden on /light-preview via the CSS mechanism in globals.css. */}
      <WhatsAppButton />
    </>
  );
}
