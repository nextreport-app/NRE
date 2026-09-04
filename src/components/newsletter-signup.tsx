"use client";

import { useState } from "react";

type Status = "idle" | "loading" | "done" | "error";

/**
 * Marketing newsletter — stores emails via the existing waitlist table
 * (planId omitted) so we can nurture visitors without a separate list infra.
 */
export function NewsletterSignup({
  compact = false,
  className = "",
}: {
  compact?: boolean;
  className?: string;
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not subscribe. Please try again.");
        setStatus("error");
        return;
      }
      setStatus("done");
      setEmail("");
    } catch {
      setError("Could not reach the server. Please try again.");
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <p className={`text-sm text-emerald-300 ${className}`}>
        You&apos;re subscribed — we&apos;ll send product updates and reporting tips. No spam.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={className}>
      {!compact ? (
        <p className="mb-2 text-xs text-ink-muted">Monthly tips, feature launches, and agency reporting playbooks.</p>
      ) : null}
      <div className={compact ? "flex gap-2" : "flex flex-col gap-2 sm:flex-row"}>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@agency.com"
          aria-label="Email for newsletter"
          className="min-w-0 flex-1 rounded-md border border-navy-border bg-navy-panel px-3 py-2 text-sm text-white outline-none placeholder:text-ink-muted focus:border-accent"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="flex-none rounded-md bg-accent-orange px-4 py-2 text-sm font-semibold text-navy hover:bg-accent-orange-hover disabled:opacity-60"
        >
          {status === "loading" ? "Joining…" : "Subscribe"}
        </button>
      </div>
      {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}
    </form>
  );
}
