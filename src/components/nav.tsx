"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

const LINKS = [
  { href: "/", label: "Home", hideOnMobile: true },
  { href: "/clients", label: "My Clients", hideOnMobile: false },
  { href: "/account", label: "Account", hideOnMobile: false },
  { href: "/billing", label: "Billing", hideOnMobile: false },
  { href: "/pricing", label: "Pricing", hideOnMobile: true },
  { href: "/help/download", label: "How It Works", hideOnMobile: true },
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
        <Link href="/" className="text-sm font-semibold text-dash-ink">
          NextReport
        </Link>
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 text-[14px] text-dash-ink-secondary sm:gap-x-5">
          {LINKS.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={
                  (link.hideOnMobile ? "hidden sm:inline " : "") +
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
            <span className="hidden max-w-[160px] truncate text-[13px] sm:inline" title={session.user.email}>
              {session.user.email}
            </span>
          )}
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="shrink-0 rounded-md border border-dash-border px-3 py-1.5 text-[14px] hover:bg-dash-card"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
