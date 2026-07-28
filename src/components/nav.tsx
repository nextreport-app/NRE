"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

export function Nav() {
  const { data: session } = useSession();

  return (
    <header className="border-b border-navy-border bg-navy/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/clients" className="text-sm font-semibold text-white">
          NextReport
        </Link>
        <div className="flex items-center gap-4 text-sm text-ink-muted">
          <Link href="/account" className="hover:text-ink-secondary">
            Account
          </Link>
          <Link href="/pricing" className="hover:text-ink-secondary">
            Pricing
          </Link>
          <Link href="/help/download" className="hover:text-ink-secondary">
            Help
          </Link>
          {session?.user?.email && <span>{session.user.email}</span>}
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="rounded-md border border-navy-border px-3 py-1.5 hover:bg-navy-panel"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
