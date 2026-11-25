"use client";
import { type ReactNode, useState } from "react";
import { useRouter } from "next/navigation";
import type { ClientProvider } from "@/lib/client-provider-connections";
import { Ga4BrandIcon, MetaAdsBrandIcon, GoogleAdsBrandIcon, TikTokAdsBrandIcon } from "@/components/platform-brand-icons";
const icons = { ga4: Ga4BrandIcon, meta: MetaAdsBrandIcon, "google-ads": GoogleAdsBrandIcon, tiktok: TikTokAdsBrandIcon };
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
  ga4Property,
  automations,
}: {
  clientId: string;
  ga4Property?: ReactNode;
  automations?: ReactNode;
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
        Use your shared agency login, or connect a different login just for this client.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {connections.map((c) => {
          const Icon = c.provider === "google-drive" ? null : icons[c.provider];
          return <article key={c.provider} className={`min-w-0 rounded-xl border border-dash-border bg-dash-bg p-4 ${c.provider === "ga4" ? "sm:col-span-2" : ""}`}>
            <div className="flex items-start gap-3">
              <span className="shrink-0" aria-hidden="true">{Icon ? <Icon /> : <svg width="40" height="40" viewBox="0 0 40 40"><rect width="40" height="40" rx="11" fill="white"/><path d="M17 8h7l10 18h-8z" fill="#FFC107"/><path d="M17 8 6 27l4 6 11-19z" fill="#34A853"/><path d="M10 33h20l4-7H14z" fill="#4285F4"/></svg>}</span>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold">{names[c.provider]}</h3>
                <p className="mt-1 break-words text-xs text-dash-ink-secondary">{c.connected ? `${c.scoped ? "Client login" : "Agency login"}${c.label ? ` · ${c.label}` : ""}` : "Not connected"}</p>
              </div>
              <span className={`rounded-full border px-2 py-1 text-[11px] ${c.connected ? "border-emerald-500/30 text-emerald-500" : "border-dash-border text-dash-ink-secondary"}`}>{c.connected ? "Connected" : c.configured ? "Not connected" : "Unavailable"}</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {c.configured && <a href={`/api/${c.provider}/connect?clientId=${encodeURIComponent(clientId)}`} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-dash-border px-3 py-2 text-xs font-semibold hover:border-dash-accent focus-visible:outline-2 focus-visible:outline-dash-accent">{c.connected ? "Choose different login" : "Connect for this client"}</a>}
              {c.scoped && <button type="button" disabled={!!busy} onClick={() => void handleUseAgency(c.provider)} className="min-h-11 rounded-lg border border-dash-border px-3 text-xs hover:border-dash-accent disabled:opacity-50">{busy === c.provider ? "Updating…" : "Use agency login"}</button>}
            </div>
            {c.provider === "meta" && <details className="mt-3 text-xs text-dash-ink-secondary"><summary className="cursor-pointer">Need another Meta profile?</summary><p className="mt-2">Switch accounts on Meta before authorizing. Stay signed in to NextReport.</p></details>}
            {c.provider === "ga4" && ga4Property}
          </article>;
        })}
      </div>
      {automations}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {error}
        </p>
      )}
    </section>
  );
}
