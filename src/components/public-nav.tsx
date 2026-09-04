"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BETA_HIDE_PRICING } from "@/lib/beta";
import { CurrencySelector } from "@/components/currency-selector";
import { PUBLIC_NAV_LINKS, SUPPORT_EMAIL, filterBetaLinks, type SiteLink } from "@/lib/site-links";

const ALL_LINKS: SiteLink[] = [
  ...PUBLIC_NAV_LINKS,
  { href: "/pricing", label: "Pricing", hideDuringBeta: true },
];

const LINKS = filterBetaLinks(ALL_LINKS, BETA_HIDE_PRICING);

function navLinkClass(active: boolean) {
  return active
    ? "font-medium text-white"
    : "text-ink-secondary transition-colors hover:text-white";
}

/**
 * Top nav for public marketing pages — auth-aware, active-route highlighting,
 * expanded link set, and a persistent demo CTA.
 */
export function PublicNav({ loggedIn }: { loggedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-navy-border bg-navy/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3.5">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <img src="/logo.png" alt="NextReport logo" className="h-9 w-9 sm:h-10 sm:w-10" />
          <span className="text-lg font-bold tracking-tight text-white sm:text-xl">NextReport</span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-md px-3 py-2 text-sm ${navLinkClass(isActive(link.href))}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <CurrencySelector compact />
          <Link
            href="/contact"
            className="rounded-md px-3 py-2 text-sm text-ink-secondary transition-colors hover:text-white"
          >
            Book a demo
          </Link>
          {loggedIn ? (
            <Link
              href="/clients"
              className="rounded-md bg-accent-orange px-4 py-2 text-sm font-semibold text-navy hover:bg-accent-orange-hover"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="rounded-md px-3 py-2 text-sm text-ink-secondary hover:text-white">
                Login
              </Link>
              <Link
                href="/signup"
                className="rounded-md bg-accent-orange px-4 py-2 text-sm font-semibold text-navy hover:bg-accent-orange-hover"
              >
                Get Started
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-navy-border text-white lg:hidden"
        >
          {open ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
              <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {open ? (
        <nav className="border-t border-navy-border bg-navy px-6 py-4 lg:hidden" aria-label="Mobile">
          <div className="flex flex-col gap-1">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`rounded-md px-3 py-2.5 text-sm ${isActive(link.href) ? "bg-navy-panel font-medium text-white" : "text-ink-secondary hover:bg-navy-panel hover:text-white"}`}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/contact"
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2.5 text-sm text-ink-secondary hover:bg-navy-panel hover:text-white"
            >
              Book a demo
            </Link>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="rounded-md px-3 py-2.5 text-sm text-ink-muted hover:text-white"
            >
              {SUPPORT_EMAIL}
            </a>
            <div className="px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Currency</p>
              <CurrencySelector compact className="mt-2" />
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2 border-t border-navy-border pt-4">
            {loggedIn ? (
              <Link
                href="/clients"
                onClick={() => setOpen(false)}
                className="rounded-md bg-accent-orange px-4 py-2.5 text-center text-sm font-semibold text-navy"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-navy-border px-4 py-2.5 text-center text-sm text-white"
                >
                  Login
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setOpen(false)}
                  className="rounded-md bg-accent-orange px-4 py-2.5 text-center text-sm font-semibold text-navy"
                >
                  Get Started — free trial
                </Link>
              </>
            )}
          </div>
        </nav>
      ) : null}
    </header>
  );
}
