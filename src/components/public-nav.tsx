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

/** Cursor-style compact marketing header type (13px, tight pills). */
const navText =
  "shrink-0 whitespace-nowrap text-[13px] leading-none text-ink transition-colors hover:opacity-80";
const navOutlinePill =
  "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full border border-navy-border px-3 py-[7px] text-[13px] font-medium leading-none text-ink transition-colors hover:bg-navy-panel/50";
const navPrimaryPill =
  "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-ink px-3 py-[7px] text-[13px] font-medium leading-none text-navy transition-opacity hover:opacity-90";

function navLinkClass(active: boolean) {
  return active ? "font-semibold text-ink" : "font-normal text-ink transition-colors hover:opacity-80";
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
    <header className="public-site-header sticky top-0 z-40 border-b border-navy-border bg-navy/95 font-sans text-[13px] antialiased backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 lg:min-w-[168px]">
          <img src="/logo.png" alt="NextReport logo" className="h-12 w-12 shrink-0" width={48} height={48} />
          <span className="text-[18px] font-semibold leading-none tracking-[-0.02em] text-ink">NextReport</span>
        </Link>

        <nav className="hidden flex-1 items-center justify-center gap-0 lg:flex" aria-label="Main">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-md px-2.5 py-1.5 text-[13px] leading-none ${navLinkClass(isActive(link.href))}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden shrink-0 items-center gap-3 lg:flex">
          {loggedIn ? (
            <>
              <button type="button" onClick={handleSignOut} className={navText}>
                {marketing.navSignOut}
              </button>
              <Link href="/contact" className={navOutlinePill}>
                {marketing.navContact}
              </Link>
              <Link href="/clients" className={navPrimaryPill}>
                {marketing.navDashboard}
              </Link>
            </>
          ) : (
            <>
              <Link href="/login" className={navText}>
                {marketing.navSignIn}
              </Link>
              <Link href="/contact" className={navOutlinePill}>
                {marketing.navContact}
              </Link>
              <Link href="/signup" className={navPrimaryPill}>
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
          className="ml-auto flex h-8 w-8 items-center justify-center rounded-md border border-navy-border text-ink lg:ml-0 lg:hidden"
        >
          {open ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true">
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true">
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
                className={`rounded-md px-3 py-2 text-[13px] ${isActive(link.href) ? "bg-navy-panel font-medium text-ink" : "text-ink hover:bg-navy-panel hover:opacity-80"}`}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/contact"
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2 text-[13px] text-ink hover:bg-navy-panel hover:opacity-80"
            >
              {marketing.navContact}
            </Link>
          </div>
          <div className="mt-4 flex flex-col gap-2 border-t border-navy-border pt-4">
            {loggedIn ? (
              <>
                <Link href="/clients" onClick={() => setOpen(false)} className={`${navPrimaryPill} w-full py-2 text-center`}>
                  {marketing.navDashboard}
                </Link>
                <button type="button" onClick={handleSignOut} className={`${navOutlinePill} w-full py-2`}>
                  {marketing.navSignOut}
                </button>
              </>
            ) : (
              <>
                <Link href="/signup" onClick={() => setOpen(false)} className={`${navPrimaryPill} w-full py-2 text-center`}>
                  {marketing.navStartTrial}
                </Link>
                <Link href="/login" onClick={() => setOpen(false)} className={`${navOutlinePill} w-full py-2 text-center`}>
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
