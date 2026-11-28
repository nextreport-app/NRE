"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function GscConnectionSettings({
  connected,
  email,
  configured,
  justConnected,
  error: initialError,
}: {
  connected: boolean;
  email: string | null;
  configured: boolean;
  justConnected?: boolean;
  error?: string;
}) {
  const router = useRouter(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function disconnect() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/gsc/disconnect", { method: "POST" });
      if (!response.ok)
        throw Error("Search Console could not be disconnected. Retry.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="rounded-xl border border-dash-border bg-dash-card p-5">
      <p className="text-sm text-dash-ink-secondary">
        Read-only Google Web Search clicks, impressions, search queries and
        rankings. This Google profile is the default; clients can choose a
        different login in Client settings → Connections.
      </p>
      {justConnected && (
        <p role="status" className="mt-3 text-sm text-dash-success">
          Search Console connected. Choose the matching site for each client.
        </p>
      )}
      {(error || initialError) && (
        <p role="alert" className="mt-3 text-sm text-dash-error">
          {error ||
            `Connection was not completed (${initialError}). Try again and allow read-only Search Console access.`}
        </p>
      )}
      <p className="mt-3 text-sm font-medium">
        {connected ? `Connected${email ? ` · ${email}` : ""}` : "Not connected"}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {configured ? (
          <a
            href="/api/gsc/connect"
            className="inline-flex min-h-11 items-center rounded-lg border border-dash-border px-3 text-sm font-semibold hover:border-dash-accent"
          >
            {connected ? "Choose different login" : "Connect Search Console"}
          </a>
        ) : (
          <p className="text-sm text-dash-ink-secondary">
            Search Console is not configured yet. Contact support.
          </p>
        )}
        {connected && (
          <button
            disabled={busy}
            onClick={() => void disconnect()}
            className="min-h-11 rounded-lg border border-dash-border px-3 text-sm disabled:opacity-50"
          >
            {busy ? "Disconnecting…" : "Disconnect default profile"}
          </button>
        )}
      </div>
      <p className="mt-3 text-xs text-dash-ink-secondary">
        Changing this default profile clears site assignments that use it.
        Client-specific logins keep their own assignments.
      </p>
    </div>
  );
}
