"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

const LINKS = [
  { href: "/", label: "Home", hideOnMobile: true },
  { href: "/clients", label: "My Clients", hideOnMobile: false },
  { href: "/account", label: "Account", hideOnMobile: false },
  { href: "/billing", label: "Billing", hideOnMobile: false },
  { href: "/support", label: "Support", hideOnMobile: false },
  { href: "/pricing", label: "Pricing", hideOnMobile: true },
  { href: "/help/download", label: "CSV Export Guide", hideOnMobile: true },
];

/** Active-page match: exact for "/", prefix for everything else (so /clients/abc still highlights "My Clients"). */
function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function Nav() {
  const { data: session } = useSession();
  const pathname = usePathname();

  return (
    <header className="border-b border-dash-border bg-dash-sidebar/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-y-2 px-4 py-3">
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: "8px", textDecoration: "none" }}>
          <img src="/logo.png" alt="NextReport logo" style={{ height: "40px", width: "40px", display: "block" }} />
          <span
            style={{
              fontWeight: 700,
              fontSize: "20px",
              color: "white",
              letterSpacing: "-0.3px",
              fontFamily: "var(--font-inter), sans-serif",
            }}
          >
            NextReport
          </span>
        </Link>
        <div className="flex min-w-0 max-w-[min(100%,52rem)] flex-1 items-center justify-end gap-x-3 gap-y-2 overflow-x-auto text-[14px] text-dash-ink-secondary sm:gap-x-4">
          {LINKS.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={
                  "shrink-0 " +
                  (link.hideOnMobile ? "hidden md:inline " : "") +
                  (active
                    ? "border-b-2 border-dash-accent pb-[2px] font-medium text-dash-ink"
                    : "border-b-2 border-transparent pb-[2px] hover:text-dash-ink")
                }
              >
                {link.label}
              </Link>
            );
          })}
          {session?.user?.email && (
            <span className="hidden max-w-[140px] truncate text-[13px] lg:inline" title={session.user.email}>
              {session.user.email}
            </span>
          )}
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="ml-1 shrink-0 rounded-full border border-dash-border px-3 py-1.5 text-[13px] font-medium text-dash-ink hover:bg-dash-card sm:text-[14px]"
            title="Sign out of NextReport (you can sign in with a different Google account next)"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
