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
      <h1 className="text-xl font-semibold text-white">Something went wrong</h1>
      <p className="max-w-md text-sm text-ink-muted">
        This page hit an unexpected server error. Try again, or head back to your clients if it
        keeps happening.
      </p>
      {error.digest && (
        <p className="text-xs text-ink-muted">
          Error reference: <span className="font-mono text-ink-secondary">{error.digest}</span>
        </p>
      )}
      <div className="flex gap-3">
        <button
          onClick={() => reset()}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
        >
          Try again
        </button>
        <Link
          href="/clients"
          className="rounded-md border border-navy-border px-4 py-2 text-sm font-medium text-white hover:bg-navy-panel"
        >
          Back to clients
        </Link>
      </div>
    </div>
  );
}
