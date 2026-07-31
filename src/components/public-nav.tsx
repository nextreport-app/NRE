"use client";

import { useState } from "react";
import Link from "next/link";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/pricing", label: "Pricing" },
  { href: "/help/download", label: "How It Works" },
];

/**
 * Top nav for public marketing pages only (home, pricing, help, about,
 * privacy, terms, contact) — never rendered inside the (dashboard) route
 * group, which has its own Nav (components/nav.tsx). Auth-aware like the
 * homepage hero: a logged-in visitor sees a single "Dashboard" link
 * instead of Login/Get Started, so this nav never contradicts the hero's
 * own "Go to Dashboard" state directly below it.
 */
export function PublicNav({ loggedIn }: { loggedIn: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-navy-border bg-navy/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-base font-bold text-white">
          NextReport
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-ink-secondary md:flex">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-white">
              {link.label}
            </Link>
          ))}
          {loggedIn ? (
            <Link
              href="/clients"
              className="rounded-md bg-accent-orange px-4 py-2 text-sm font-semibold text-navy hover:bg-accent-orange-hover"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="hover:text-white">
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
        </nav>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-navy-border text-white md:hidden"
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

      {open && (
        <nav className="flex flex-col gap-1 border-t border-navy-border bg-navy px-6 py-4 text-sm text-ink-secondary md:hidden">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="rounded-md px-2 py-2 hover:bg-navy-panel hover:text-white"
            >
              {link.label}
            </Link>
          ))}
          {loggedIn ? (
            <Link
              href="/clients"
              onClick={() => setOpen(false)}
              className="mt-2 rounded-md bg-accent-orange px-4 py-2 text-center text-sm font-semibold text-navy hover:bg-accent-orange-hover"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="rounded-md px-2 py-2 hover:bg-navy-panel hover:text-white"
              >
                Login
              </Link>
              <Link
                href="/signup"
                onClick={() => setOpen(false)}
                className="mt-2 rounded-md bg-accent-orange px-4 py-2 text-center text-sm font-semibold text-navy hover:bg-accent-orange-hover"
              >
                Get Started
              </Link>
            </>
          )}
        </nav>
      )}
    </header>
  );
}
