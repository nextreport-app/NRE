"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useSiteCopy } from "@/hooks/use-site-copy";
const LINK_HREFS = [
  { href: "/", key: "navHome" as const, hideOnMobile: true },
  { href: "/clients", key: "navClients" as const, hideOnMobile: false },
  { href: "/account", key: "navAccount" as const, hideOnMobile: false },
  { href: "/billing", key: "navBilling" as const, hideOnMobile: false },
  { href: "/support", key: "navSupport" as const, hideOnMobile: false },
  { href: "/pricing", key: "navPricing" as const, hideOnMobile: true },
  { href: "/help/download", key: "navCsvGuide" as const, hideOnMobile: true },
];

/** Active-page match: exact for "/", prefix for everything else (so /clients/abc still highlights "My Clients"). */
function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function Nav() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const { dashboard: d } = useSiteCopy();

  return (
    <header className="nre-dash-nav border-b border-dash-border bg-dash-sidebar/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-y-2 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 no-underline">
          <img src="/logo.png" alt="NextReport logo" className="block h-10 w-10" />
          <span className="text-[20px] font-bold tracking-[-0.3px] text-dash-ink" style={{ fontFamily: "var(--font-inter), sans-serif" }}>
            NextReport
          </span>
        </Link>
        <div className="flex min-w-0 max-w-[min(100%,52rem)] flex-1 items-center justify-end gap-x-3 gap-y-2 overflow-x-auto text-[14px] sm:gap-x-4">
          {LINK_HREFS.map((link) => {
            const active = isActive(pathname, link.href);
            const label = d[link.key];
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
                {label}
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
            title={d.navSignOutTitle}
          >
            {d.navSignOut}
          </button>
        </div>
      </div>
    </header>
  );
}
