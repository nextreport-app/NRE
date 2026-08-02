"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
      <h1 className="text-xl font-semibold text-dash-ink">Something went wrong</h1>
      <p className="max-w-md text-sm text-dash-ink-secondary">
        This page hit an unexpected server error. Try again, or head back to your clients if it
        keeps happening.
      </p>
      {error.digest && (
        <p className="text-[13px] text-dash-ink-secondary">
          Error reference: <span className="font-mono text-dash-ink-secondary">{error.digest}</span>
        </p>
      )}
      <div className="flex gap-3">
        <button
          onClick={() => reset()}
          className="rounded-md bg-dash-accent px-4 py-2 text-sm font-medium text-dash-ink hover:bg-dash-accent-hover"
        >
          Try again
        </button>
        <Link
          href="/clients"
          className="rounded-md border border-dash-border px-4 py-2 text-sm font-medium text-dash-ink hover:bg-dash-card"
        >
          Back to clients
        </Link>
      </div>
    </div>
  );
}
