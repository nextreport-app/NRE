"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ClientProvider } from "@/lib/client-provider-connections";
const names: Record<ClientProvider, string> = {
  ga4: "Google Analytics (GA4)",
  meta: "Meta Ads",
  "google-drive": "Google Drive",
  "google-ads": "Google Ads",
  tiktok: "TikTok Ads",
};
export function ClientProviderSettings({
  clientId,
  connections,
}: {
  clientId: string;
  connections: Array<{
    provider: ClientProvider;
    scoped: boolean;
    connected: boolean;
    label: string | null;
    configured: boolean;
  }>;
}) {
  const router = useRouter(),
    [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  async function handleUseAgency(provider: ClientProvider) {
    setBusy(provider);
    setError("");
    try {
      const res = await fetch(
        `/api/clients/${clientId}/connections/${provider}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (!res.ok) throw Error(data.error ?? "Could not change connection.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not change connection.");
    } finally {
      setBusy("");
    }
  }
  return (
    <section
      id="provider-connections"
      className="rounded-xl border border-dash-border bg-dash-card p-5"
    >
      <h2 className="text-lg font-semibold">Connections for this client</h2>
      <p className="mt-2 text-sm text-dash-ink-secondary">
        Use your shared agency login, or connect a different login just for this
        client. Other clients keep their connections.
      </p>
      <p className="mt-2 text-xs text-dash-ink-secondary">
        After changing a Meta, GA4 or Drive login, choose its ad account,
        property or destination folder again.
      </p>
      <div className="mt-4 divide-y divide-dash-border">
        {connections.map((c) => (
          <div
            key={c.provider}
            className="flex flex-wrap items-center justify-between gap-3 py-4"
          >
            <div>
              <h3 className="text-sm font-semibold">{names[c.provider]}</h3>
              <p className="mt-1 text-xs text-dash-ink-secondary">
                {c.connected
                  ? `${c.scoped ? "Client login" : "Agency login"}${c.label ? ` · ${c.label}` : ""}`
                  : "Not connected"}
              </p>
            </div>
            {c.provider === "meta" && (
              <p className="mt-1 max-w-sm text-xs text-dash-ink-secondary">
                If Meta shows the wrong profile, switch accounts on Meta before
                authorizing. Stay signed in to NextReport.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {c.configured && (
                <a
                  href={`/api/${c.provider}/connect?clientId=${encodeURIComponent(clientId)}`}
                  className="inline-flex min-h-10 items-center rounded-lg border border-dash-border bg-dash-bg px-3 py-2 text-xs font-semibold hover:border-dash-accent"
                >
                  {c.connected
                    ? "Connect a different login"
                    : "Connect for this client"}
                </a>
              )}
              {c.scoped && (
                <button
                  disabled={!!busy}
                  onClick={() => void handleUseAgency(c.provider)}
                  className="min-h-10 rounded-lg border border-dash-border px-3 text-xs disabled:opacity-50"
                >
                  {busy === c.provider ? "Updating…" : "Use agency connection"}
                </button>
              )}
              {!c.configured && (
                <span className="text-xs text-dash-ink-secondary">
                  Not available
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {error}
        </p>
      )}
    </section>
  );
}
