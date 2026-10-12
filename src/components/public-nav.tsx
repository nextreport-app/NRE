"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { BETA_HIDE_PRICING } from "@/lib/beta";
import { PUBLIC_NAV_LINKS, filterBetaLinks, type SiteLink } from "@/lib/site-links";
import { useSiteCopy } from "@/hooks/use-site-copy";

const ALL_LINKS: SiteLink[] = [
  ...PUBLIC_NAV_LINKS,
  { href: "/pricing", label: "Pricing", hideDuringBeta: true },
];

const navPillPrimary =
  "inline-flex items-center justify-center rounded-full bg-ink px-4 py-2 text-sm font-semibold text-navy transition-opacity hover:opacity-90";

function navLinkClass(active: boolean) {
  return active
    ? "font-medium text-white"
    : "text-ink-secondary transition-colors hover:text-white";
}

export function PublicNav({ loggedIn }: { loggedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { marketing, linkLabel } = useSiteCopy();

  const links = filterBetaLinks(ALL_LINKS, BETA_HIDE_PRICING).map((link) => ({
    href: link.href,
    label: linkLabel(link.href, link.label),
  }));

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function handleSignOut() {
    setOpen(false);
    void signOut({ callbackUrl: "/login" });
  }

  return (
    <header className="public-site-header sticky top-0 z-40 border-b border-navy-border bg-navy/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 lg:w-[168px]">
          <img src="/logo.png" alt="NextReport logo" className="h-9 w-9 sm:h-10 sm:w-10" />
          <span className="text-lg font-bold tracking-tight text-white sm:text-xl">NextReport</span>
        </Link>

        <nav className="hidden flex-1 items-center justify-center gap-0.5 lg:flex" aria-label="Main">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-full px-3 py-2 text-sm ${navLinkClass(isActive(link.href))}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden shrink-0 items-center justify-end gap-2.5 lg:flex">
          {loggedIn ? (
            <>
              <button
                type="button"
                onClick={handleSignOut}
                className="shrink-0 whitespace-nowrap rounded-full px-3 py-2 text-sm text-ink-secondary hover:text-white"
              >
                {marketing.navSignOut}
              </button>
              <Link
                href="/contact"
                className="shrink-0 whitespace-nowrap rounded-full px-3 py-2 text-sm text-ink-secondary hover:text-white"
              >
                {marketing.navContact}
              </Link>
              <Link href="/clients" className={`${navPillPrimary} shrink-0 whitespace-nowrap`}>
                {marketing.navDashboard}
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="shrink-0 whitespace-nowrap rounded-full px-3 py-2 text-sm text-ink-secondary hover:text-white"
              >
                {marketing.navSignIn}
              </Link>
              <Link
                href="/contact"
                className="shrink-0 whitespace-nowrap rounded-full px-3 py-2 text-sm text-ink-secondary hover:text-white"
              >
                {marketing.navContact}
              </Link>
              <Link href="/signup" className={`${navPillPrimary} shrink-0 whitespace-nowrap`}>
                {marketing.navStartTrial}
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          className="ml-auto flex h-9 w-9 items-center justify-center rounded-md border border-navy-border text-white lg:ml-0 lg:hidden"
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
        <nav className="border-t border-navy-border bg-navy px-4 py-4 sm:px-6 lg:hidden" aria-label="Mobile">
          <div className="flex flex-col gap-1">
            {links.map((link) => (
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
              {marketing.navContact}
            </Link>
          </div>
          <div className="mt-4 flex flex-col gap-2 border-t border-navy-border pt-4">
            {loggedIn ? (
              <>
                <Link
                  href="/clients"
                  onClick={() => setOpen(false)}
                  className={`${navPillPrimary} w-full py-2.5 text-center`}
                >
                  {marketing.navDashboard}
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full rounded-full border border-navy-border px-4 py-2.5 text-center text-sm text-white hover:bg-navy-panel"
                >
                  {marketing.navSignOut}
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/signup"
                  onClick={() => setOpen(false)}
                  className={`${navPillPrimary} w-full py-2.5 text-center`}
                >
                  {marketing.navStartTrial}
                </Link>
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="w-full rounded-full border border-navy-border px-4 py-2.5 text-center text-sm text-white hover:bg-navy-panel"
                >
                  {marketing.navSignIn}
                </Link>
              </>
            )}
          </div>
        </nav>
      ) : null}
    </header>
  );
}
