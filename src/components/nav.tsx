"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

export function Nav() {
  const { data: session } = useSession();

  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/clients" className="text-sm font-semibold text-white">
          NextReport
        </Link>
        <div className="flex items-center gap-4 text-sm text-slate-400">
          {session?.user?.email && <span>{session.user.email}</span>}
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="rounded-md border border-slate-700 px-3 py-1.5 hover:bg-slate-900"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
