"use client";

import { useState } from "react";

/**
 * Replaces the Subscribe button for USD/international visitors — Stripe
 * isn't wired up yet (see lib/razorpay.ts's file header for why only
 * Razorpay/INR has a real checkout today), so this collects an email
 * instead via POST /api/waitlist. Deliberately public/no-auth, matching
 * that route — most visitors here are anonymous marketing-page traffic.
 */
export function WaitlistForm({
  planId,
  country,
  className,
}: {
  planId: "starter" | "professional";
  /** The detected country code, if ipapi.co resolved one — passed through as metadata even if the visitor manually switched the displayed currency to USD. */
  country?: string | null;
  className?: string;
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, planId, country: country ?? undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not join the waitlist. Please try again.");
        setStatus("error");
        return;
      }
      setStatus("done");
    } catch {
      setError("Could not reach the server. Please try again.");
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className={`${className ?? ""} rounded-md border border-emerald-800 bg-emerald-950/30 px-4 py-2.5 text-center text-sm text-emerald-300`}>
        You&apos;re on the list — we&apos;ll email you when international payments are ready.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={className}>
      <p className="mb-2 text-xs font-medium text-ink-muted">
        International payments coming soon — join our waitlist
      </p>
      <div className="flex gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          className="min-w-0 flex-1 rounded-md border border-navy-border bg-navy px-3 py-2 text-sm text-white outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="flex-none rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-60"
        >
          {status === "loading" ? "Joining…" : "Join waitlist"}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </form>
  );
}
