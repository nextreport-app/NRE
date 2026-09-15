"use client";

import Link from "next/link";

export function SpecificFieldWarning({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-amber-900 bg-amber-950/30 p-4 text-[14px] text-amber-200">
      <p>{message}</p>
      <Link href="/help/download" target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-amber-300 underline hover:text-amber-100">
        See our CSV Export Guide →
      </Link>
    </div>
  );
}
